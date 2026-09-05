import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Plus, X, Clock, BarChart2, Globe, BookOpen, Send, Star, ChevronRight, ChevronLeft } from 'lucide-react';
import { createCourse, getApprovedCourses, uploadInstructorPhoto, uploadSyllabusPdf, type CourseResponse, type CreateCourseRequest } from '../services/courseService';
import './HeroSlider.css';

const AUTO_INTERVAL = 8000;

// ── Social Icons ───────────────────────────────────────────────
const IconLinkedin = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);
const IconGithub = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Accent color array for new courses
const ACCENT_COLORS = ['--brand-primary', '--brand-success', '--brand-gold', '--brand-danger'];

// ── CourseAd adapter — maps CourseResponse to UI shape ──────────
interface CourseAdUI {
  id: string;
  kicker: string;
  instructor: string;
  instructorInitials: string;
  role: string;
  company: string;
  instructorPhoto?: string;
  socials?: { linkedin?: string; github?: string };
  contactEmail?: string;
  contactPhone?: string;
  courseTitle: string;
  description: string;
  duration: string;
  level: string;
  language: string;
  syllabus: string[];
  accentColor: string;
  ctaText: string;
  ctaLink: string;
  syllabusFile?: string;
}

function mapCourseToUI(course: CourseResponse, index: number): CourseAdUI {
  const host = (import.meta.env.VITE_API_URL || 'http://localhost:5251/api').replace('/api', '');
  return {
    id: String(course.id),
    kicker: course.kicker || 'YENİ TƏLİM',
    instructor: course.instructorName,
    instructorInitials: course.instructorInitials,
    role: course.instructorRole,
    company: course.instructorCompany || '',
    instructorPhoto: course.instructorPhotoUrl ? `${host}${course.instructorPhotoUrl}` : undefined,
    socials: {
      linkedin: course.linkedInUrl || undefined,
      github: course.gitHubUrl || undefined,
    },
    contactEmail: course.contactEmail || undefined,
    contactPhone: course.contactPhone || undefined,
    courseTitle: course.courseTitle,
    description: course.description,
    duration: course.duration,
    level: course.level,
    language: course.language,
    syllabus: course.syllabusTopics,
    accentColor: course.accentColor || ACCENT_COLORS[index % ACCENT_COLORS.length],
    ctaText: 'Detallara Bax',
    ctaLink: `#course-${course.id}`,
    syllabusFile: course.syllabusFileUrl ? `${host}${course.syllabusFileUrl}` : undefined,
  };
}

// ── Add Course Modal ───────────────────────────────────────────
function AddCourseModal({ onClose, onCourseAdded }: { onClose: () => void; onCourseAdded: () => void }) {
  const [syllabus, setSyllabus] = useState(['', '', '']);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);

  const addSyllabus = () => setSyllabus(p => [...p, '']);
  const updateSyllabus = (i: number, v: string) => setSyllabus(p => p.map((x, idx) => idx === i ? v : x));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    const form = e.target as HTMLFormElement;

    // 1. Faylları təhlükəsiz şəkildə yükləyirik
    let instructorPhotoUrl: string | undefined = undefined;
    let syllabusFileUrl: string | undefined = undefined;

    try {
      if (photoFile) {
        const photoResult = await uploadInstructorPhoto(photoFile);
        if (!photoResult.success || !photoResult.data) {
          setErrors(photoResult.errors?.length ? photoResult.errors : [photoResult.message || 'Müəllim şəkli yüklənərkən xəta baş verdi.']);
          setLoading(false);
          return;
        }
        instructorPhotoUrl = photoResult.data;
      }

      if (syllabusFile) {
        const syllabusResult = await uploadSyllabusPdf(syllabusFile);
        if (!syllabusResult.success || !syllabusResult.data) {
          setErrors(syllabusResult.errors?.length ? syllabusResult.errors : [syllabusResult.message || 'Təlim sillabusu yüklənərkən xəta baş verdi.']);
          setLoading(false);
          return;
        }
        syllabusFileUrl = syllabusResult.data;
      }

      const request: CreateCourseRequest = {
        instructorName: (form.querySelector('#instructor') as HTMLInputElement).value,
        instructorRole: (form.querySelector('#role') as HTMLInputElement).value,
        instructorCompany: (form.querySelector('#company') as HTMLInputElement).value || undefined,
        linkedInUrl: (form.querySelector('#linkedin') as HTMLInputElement).value || undefined,
        gitHubUrl: (form.querySelector('#github') as HTMLInputElement).value || undefined,
        contactEmail: (form.querySelector('#contactEmail') as HTMLInputElement).value || undefined,
        contactPhone: (form.querySelector('#contactPhone') as HTMLInputElement).value || undefined,
        courseTitle: (form.querySelector('#courseTitle') as HTMLInputElement).value,
        kicker: (form.querySelector('#kicker') as HTMLInputElement).value || undefined,
        description: (form.querySelector('#description') as HTMLTextAreaElement).value,
        duration: (form.querySelector('#duration') as HTMLInputElement).value || '',
        level: (form.querySelector('#level') as HTMLSelectElement).value || '',
        language: (form.querySelector('#lang') as HTMLSelectElement).value || 'Azərbaycan dili',
        syllabusTopics: syllabus.filter(s => s.trim() !== ''),
        accentColor: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
        instructorPhotoUrl: instructorPhotoUrl,
        syllabusFileUrl: syllabusFileUrl,
      };

      const result = await createCourse(request);
      if (result.success) {
        setSubmitted(true);
        onCourseAdded();
      } else {
        // Serverdən bir neçə xəta gələ bilər — hamısı bir sətirdə birləşdirilsə oxunmur.
        setErrors(result.errors?.length ? result.errors : [result.message || 'Xəta baş verdi.']);
      }
    } catch {
      setErrors(['Serverlə əlaqə yaradıla bilmədi.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <div>
            <div className="modal-kicker"><span className="kicker-pulse" />KİBERAZ.AZ</div>
            <h2 className="modal-title">Təlimini Platformaya Əlavə Et</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><X size={18} /></button>
        </div>
        {submitted ? (
          <div className="modal-success">
            <div className="success-icon">✓</div>
            <h3>Göndərildi!</h3>
            <p>
              Təliminiz qeydə alındı və <strong>moderasiya növbəsinə</strong> düşdü.
              Admin təsdiqlədikdən sonra saytda görünəcək.
            </p>
            <button className="btn btn-primary btn-lg" onClick={onClose}>Bağla</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="form-section-label">👤 Müəllim Məlumatları</div>
            <div className="form-grid-2">
              <div className="form-field"><label htmlFor="instructor">Müəllim Adı *</label><input id="instructor" type="text" placeholder="Ad Soyad" required /></div>
              <div className="form-field"><label htmlFor="role">Vəzifə *</label><input id="role" type="text" placeholder="Senior Security Engineer" required /></div>
            </div>
            <div className="form-grid-3">
              <div className="form-field"><label htmlFor="company">Şirkət</label><input id="company" type="text" placeholder="IBM Security" /></div>
              <div className="form-field"><label htmlFor="linkedin">LinkedIn URL</label><input id="linkedin" type="url" placeholder="https://linkedin.com/in/..." /></div>
              <div className="form-field"><label htmlFor="github">GitHub URL</label><input id="github" type="url" placeholder="https://github.com/..." /></div>
            </div>
            <div className="form-field">
              <label htmlFor="photoFile">Müəllim Şəkli (PNG, JPG, WEBP — Max 2MB)</label>
              <input id="photoFile" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={{ padding: '8px' }} />
            </div>

            <div className="form-section-label">📚 Təlim Məlumatları</div>
            <div className="form-grid-2">
              <div className="form-field"><label htmlFor="courseTitle">Təlim Başlığı *</label><input id="courseTitle" type="text" placeholder="Web Application Pentesting" required /></div>
              <div className="form-field"><label htmlFor="kicker">Üst Başlıq (Kicker)</label><input id="kicker" type="text" placeholder="YENİ QRUP: 15 OKTYABR" /></div>
            </div>
            <div className="form-grid-3">
              <div className="form-field"><label htmlFor="duration">Müddət *</label><input id="duration" type="text" placeholder="8 həftə" required minLength={2} /></div>
              <div className="form-field"><label htmlFor="level">Səviyyə *</label>
                <select id="level" required>
                  <option value="">Seçin...</option>
                  <option>Başlanğıc</option><option>Başlanğıc → Orta</option>
                  <option>Orta</option><option>Orta → Peşəkar</option><option>Peşəkar</option>
                </select>
              </div>
              <div className="form-field"><label htmlFor="lang">Dil</label>
                <select id="lang"><option>Azərbaycan dili</option><option>İngilis dili</option><option>Rus dili</option></select>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="syllabusFile">Təlim Sillabusu (PDF — Max 10MB)</label>
              <input id="syllabusFile" type="file" accept="application/pdf" onChange={e => setSyllabusFile(e.target.files?.[0] || null)} style={{ padding: '8px' }} />
            </div>
            <div className="form-field"><label htmlFor="description">Təlim Açıqlaması *</label><textarea id="description" rows={3} placeholder="Təlimin məzmunu, hədəf auditoriyası..." required /></div>
            <div className="form-grid-2">
              <div className="form-field"><label htmlFor="contactEmail">E-poçt (Gmail)</label><input id="contactEmail" type="email" placeholder="təlim@gmail.com" /></div>
              <div className="form-field"><label htmlFor="contactPhone">Əlaqə nömrəsi</label><input id="contactPhone" type="tel" placeholder="+994 XX XXX XX XX" /></div>
            </div>
            <div className="form-field">
              <label>Proqram Mövzuları</label>
              <div className="syllabus-inputs">
                {syllabus.map((s, i) => (
                  <div key={i} className="syllabus-input-row">
                    <span className="syllabus-input-num">{String(i + 1).padStart(2, '0')}</span>
                    <input type="text" value={s} onChange={e => updateSyllabus(i, e.target.value)} placeholder={`Mövzu ${i + 1}...`} />
                  </div>
                ))}
                <button type="button" className="btn-add-row" onClick={addSyllabus}><Plus size={12} /> Mövzu əlavə et</button>
              </div>
            </div>
            {errors.length > 0 && (
              <ul className="form-error-list" role="alert" aria-live="assertive">
                {errors.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            )}
            <div className="modal-footer">
              <p className="modal-note">* Mütləq doldurulmalı olan sahələr.</p>
              <div className="modal-footer-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Ləğv et</button>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                  <Send size={14} /> {loading ? 'Göndərilir...' : 'Göndər'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Course Details Modal ──────────────────────────────────────
function CourseDetailsModal({ ad, onClose }: { ad: CourseAdUI; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel modal-details">
        <div className="modal-header">
          <div>
            <div className="modal-kicker"><span className="kicker-pulse" style={{ background: `var(${ad.accentColor})` }} />TƏLİM TƏFƏRRÜATİ</div>
            <h2 className="modal-title">{ad.courseTitle}</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-form">
          <div className="details-instructor-row">
            <div className="details-avatar" style={{ '--ad-clr': `var(${ad.accentColor})`, overflow: 'hidden' } as React.CSSProperties}>
              {ad.instructorPhoto ? (
                <img src={ad.instructorPhoto} alt={ad.instructor} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                ad.instructorInitials
              )}
            </div>
            <div>
              <div className="details-name">{ad.instructor}</div>
              <div className="details-role">{ad.role}{ad.company ? ` · ${ad.company}` : ''}</div>
              <div className="details-socials">
                {ad.socials?.linkedin && <a href={ad.socials.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="social-link"><IconLinkedin size={14} /></a>}
                {ad.socials?.github && <a href={ad.socials.github} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="social-link"><IconGithub size={14} /></a>}
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 'var(--text-base)' }}>{ad.description}</p>
          <div className="details-meta-row">
            <span><Clock size={13} /> {ad.duration}</span>
            <span><BarChart2 size={13} /> {ad.level}</span>
            <span><Globe size={13} /> {ad.language}</span>
            {ad.contactEmail && <span>✉ {ad.contactEmail}</span>}
            {ad.contactPhone && <span>📞 {ad.contactPhone}</span>}
          </div>
          <div style={{
            background: 'rgba(0, 229, 160, 0.05)',
            border: '1px solid rgba(0, 229, 160, 0.25)',
            borderRadius: 'var(--r-lg)',
            padding: '10px 14px',
            fontSize: 'var(--text-xs)',
            color: 'var(--brand-success)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            lineHeight: '1.4'
          }}>
            <span>🛡️</span>
            <span>Bu təlimin faylları və keçid linkləri admin tərəfindən tam yoxlanılmışdır. Təhlükəsiz şəkildə keçid edə və yükləyə bilərsiniz.</span>
          </div>
          {ad.syllabus.length > 0 && (
            <div className="details-syllabus">
              <div className="details-syllabus-label"><BookOpen size={13} /> Tam Proqram</div>
              <div className="details-syllabus-grid">
                {ad.syllabus.map((s, i) => (
                  <div key={i} className="details-syllabus-item">
                    <span className="syl-num" style={{ color: `var(${ad.accentColor})` }}>{String(i + 1).padStart(2, '0')}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="modal-footer-actions" style={{ paddingTop: 'var(--sp-4)' }}>
            <button className="btn btn-secondary" onClick={onClose}>Bağla</button>
            {ad.syllabusFile && (
              <a href={ad.syllabusFile} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center', background: `var(${ad.accentColor})`, color: '#000' }}>
                Sillabusu PDF Yüklə <ArrowRight size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Hero ──────────────────────────────────────────────────
export default function HeroSlider() {
  const [courses, setCourses] = useState<CourseAdUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── API-dan təlimləri çəkmək ──────────────────────────────────
  const fetchCourses = async () => {
    try {
      const result = await getApprovedCourses();
      if (result.success && result.data) {
        setCourses(result.data.map((c, i) => mapCourseToUI(c, i)));
      }
    } catch {
      // Əlaqə xətası — boş siyahı göstərilir
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const ad = courses[activeIdx];

  const startProgress = () => {
    setProgress(0);
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      setProgress(p => Math.min(p + (100 / (AUTO_INTERVAL / 100)), 100));
    }, 100);
  };

  const goTo = (idx: number) => {
    if (isAnimating || idx === activeIdx || courses.length === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActiveIdx(idx);
      setIsAnimating(false);
    }, 400);
    startProgress();
    if (timerRef.current) clearInterval(timerRef.current);
    if (!modalOpen && !detailsOpen) {
      timerRef.current = setInterval(() => {
        setActiveIdx(i => (i + 1) % courses.length);
        startProgress();
      }, AUTO_INTERVAL);
    }
  };

  useEffect(() => {
    if (modalOpen || detailsOpen || courses.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }
    startProgress();
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % courses.length);
      startProgress();
    }, AUTO_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [modalOpen, detailsOpen, courses.length]);

  // ── Boş / yüklənmə halı ─────────────────────────────────────
  if (loading) {
    return (
      <section id="home" className="hero" aria-label="Təlim bölməsi">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-content" style={{ justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="kicker-pulse" style={{ width: 24, height: 24, borderRadius: '50%', margin: '0 auto var(--sp-4)', background: 'var(--brand-primary)' }} />
            <p>Təlimlər yüklənir...</p>
          </div>
        </div>
      </section>
    );
  }

  if (courses.length === 0) {
    return (
      <section id="home" className="hero" aria-label="Təlim bölməsi">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-content" style={{ justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-3)' }}>📚 Hələ ki təlim əlavə olunmayıb</p>
            <p style={{ marginBottom: 'var(--sp-4)' }}>İlk təliminizi platformaya əlavə edin!</p>
            <button className="btn-add-course" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Təlim Əlavə et
            </button>
          </div>
        </div>
        {modalOpen && <AddCourseModal onClose={() => setModalOpen(false)} onCourseAdded={fetchCourses} />}
      </section>
    );
  }

  // Accent color for current slide
  const accentVar = `var(${ad.accentColor})`;

  return (
    <>
      <section id="home" className="hero" aria-label="Ana bölmə">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-scanline" aria-hidden="true" />

        {/* Dynamic accent glow behind card */}
        <div className="hero-accent-glow" style={{ '--accent': accentVar } as React.CSSProperties} aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-section-title">
            <span className="section-title-glow" style={{ background: accentVar }} aria-hidden="true"></span>
            <h2>Azərbaycanın Kibertəhlükəsizlik Təlimləri</h2>
            <p>Sıfırdan kiber mütəxəssisə çevrilmə yolunda tam əhatəli təlim proqramları</p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0, 229, 160, 0.05)',
              border: '1px solid rgba(0, 229, 160, 0.2)',
              borderRadius: 'var(--r-full)',
              padding: '6px 16px',
              fontSize: '11px',
              color: 'var(--brand-success)',
              marginTop: '12px',
              fontWeight: '500',
              lineHeight: '1.4'
            }}>
              <span>🛡️</span>
              <span>Bu təlimin faylları və keçid linkləri Admin tərəfindən tam yoxlanılmışdır. Təhlükəsiz şəkildə keçid edə və yükləyə bilərsiniz.</span>
            </div>
          </div>

          {/* ── LEFT: Instructor Identity Panel ── */}
          <div className={`hero-identity ${isAnimating ? 'slide-exit' : 'slide-enter'}`}>

            <div className="identity-kicker">
              <span className="kicker-pulse" style={{ background: accentVar }} />
              <span style={{ color: accentVar }}>{ad.kicker}</span>
            </div>

            <div className="identity-avatar-wrap">
              <div className="identity-avatar" style={{ '--ad-clr': accentVar, overflow: 'hidden' } as React.CSSProperties}>
                {ad.instructorPhoto ? (
                  <img src={ad.instructorPhoto} alt={ad.instructor} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  ad.instructorInitials
                )}
              </div>
              <div className="identity-avatar-ring" style={{ borderColor: accentVar }} />
            </div>

            <div className="identity-info">
              <div className="identity-name">{ad.instructor}</div>
              <div className="identity-role">{ad.role}</div>
              <div className="identity-company">{ad.company}</div>
            </div>

            <div className="identity-socials">
              {ad.socials?.linkedin && (
                <a href={ad.socials.linkedin} target="_blank" rel="noreferrer" className="social-pill">
                  <IconLinkedin size={13} /> LinkedIn
                </a>
              )}
              {ad.socials?.github && (
                <a href={ad.socials.github} target="_blank" rel="noreferrer" className="social-pill">
                  <IconGithub size={13} /> GitHub
                </a>
              )}
            </div>
          </div>

          {/* ── RIGHT: Course Billboard ── */}
          <div className={`hero-billboard ${isAnimating ? 'slide-exit' : 'slide-enter'}`}>

            <div className="billboard-level-badge" style={{ borderColor: accentVar, color: accentVar }}>
              <BarChart2 size={11} /> {ad.level}
            </div>

            <h1 className="billboard-title">{ad.courseTitle}</h1>
            <p className="billboard-desc">{ad.description}</p>

            <div className="billboard-meta">
              <span><Clock size={13} /> {ad.duration}</span>
              <span><Globe size={13} /> {ad.language}</span>
              {ad.contactEmail && <span>✉ {ad.contactEmail}</span>}
              {ad.contactPhone && <span>📞 {ad.contactPhone}</span>}
              <span><Star size={13} /> 4.9 / 5.0</span>
            </div>

            {ad.syllabus.length > 0 && (
              <div className="billboard-syllabus">
                <div className="syllabus-header"><BookOpen size={13} /> Nə öyrənəcəksiniz?</div>
                <div className="syllabus-chips">
                  {ad.syllabus.slice(0, 5).map((s, i) => (
                    <span key={i} className="syllabus-chip">
                      <span className="chip-dot" style={{ background: accentVar }} />
                      {s}
                    </span>
                  ))}
                  {ad.syllabus.length > 5 && (
                    <span className="syllabus-chip chip-more">+{ad.syllabus.length - 5} mövzu</span>
                  )}
                </div>
              </div>
            )}

            <div className="billboard-actions">
              <button className="btn-cta-primary" style={{ '--accent': accentVar, '--accent-rgb': 'var(--brand-primary-rgb)' } as React.CSSProperties} onClick={() => setDetailsOpen(true)}>
                Detallara Bax <ArrowRight size={18} />
              </button>
              {ad.syllabusFile && (
                <a
                  href={ad.syllabusFile}
                  target="_blank" rel="noreferrer"
                  className="btn-cta-secondary"
                >
                  Sillabusu Yüklə
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom Controls ── */}
        <div className="hero-controls">
          <div className="controls-inner">
            <button className="ctrl-nav-btn" onClick={() => goTo((activeIdx - 1 + courses.length) % courses.length)} aria-label="Əvvəlki">
              <ChevronLeft size={16} />
            </button>

            <div className="ctrl-slides" role="tablist">
              {courses.map((item, idx) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={idx === activeIdx}
                  className={`ctrl-slide-btn ${idx === activeIdx ? 'active' : ''}`}
                  style={idx === activeIdx ? { '--accent': `var(${item.accentColor})` } as React.CSSProperties : {}}
                  onClick={() => goTo(idx)}
                >
                  <span className="ctrl-slide-label">{item.courseTitle.split(' ').slice(0, 3).join(' ')}</span>
                  {idx === activeIdx && (
                    <div className="ctrl-progress-bar">
                      <div className="ctrl-progress-fill" style={{ width: `${progress}%`, background: `var(${item.accentColor})` }} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button className="ctrl-nav-btn" onClick={() => goTo((activeIdx + 1) % courses.length)} aria-label="Növbəti">
              <ChevronRight size={16} />
            </button>

            <button className="btn-add-course" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Təlim Əlavə et
            </button>
          </div>
        </div>
      </section>

      {modalOpen && <AddCourseModal onClose={() => setModalOpen(false)} onCourseAdded={fetchCourses} />}
      {detailsOpen && ad && <CourseDetailsModal ad={courses[activeIdx]} onClose={() => setDetailsOpen(false)} />}
    </>
  );
}
