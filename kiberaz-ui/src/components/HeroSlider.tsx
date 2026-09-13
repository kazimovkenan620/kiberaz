import { useCallback, useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { ArrowRight, BarChart2, BookOpen, Clock, FileText, Globe, Mail, Phone, Plus, Send, ShieldCheck } from 'lucide-react';
import { createCourse, getApprovedCourses, uploadInstructorPhoto, uploadSyllabusPdf, type CourseResponse, type CreateCourseRequest } from '../services/courseService';
import { getToken } from '../services/authService';
import { courseAccentColor, DEFAULT_COURSE_ACCENT } from '../utils/courseAccent';
import { Button, ButtonLink, EmptyState, ErrorState, FormField, Modal, SkeletonList } from './ui';
import './HeroSlider.css';

// ─── Təlimlər (kurs kəşfi) ────────────────────────────────────
// Əvvəlki avtomatik karusel sakit kart şəbəkəsi ilə əvəz edilib: kartda yalnız
// skan edilə bilən əsas məlumat, tam təfərrüat detal pəncərəsindədir.
// Backend məlumatının heç bir sahəsi itirilməyib (müəllim, sosial linklər,
// əlaqə, müddət, səviyyə, dil, mövzular, sillabus PDF, detal, kurs əlavə etmə).

// ── Social Icons ───────────────────────────────────────────────
const IconLinkedin = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);
const IconGithub = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Yalnız http(s) keçidləri kliklənə bilən link kimi göstərilir (server də https tələb edir;
// bu, köhnə qeydlər üçün ikinci qatdır).
function isSafeExternalLink(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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
  syllabusFile?: string;
}

function mapCourseToUI(course: CourseResponse): CourseAdUI {
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
    accentColor: courseAccentColor(course.accentColor),
    syllabusFile: course.syllabusFileUrl ? `${host}${course.syllabusFileUrl}` : undefined,
  };
}

function InstructorAvatar({ ad, size = 'md' }: { ad: CourseAdUI; size?: 'md' | 'lg' }) {
  return (
    <span className={`avatar${size === 'lg' ? ' avatar--lg' : ''} course-avatar`} style={{ '--accent': ad.accentColor } as React.CSSProperties}>
      {ad.instructorPhoto ? <img src={ad.instructorPhoto} alt="" /> : ad.instructorInitials}
    </span>
  );
}

// ── Add Course Modal ───────────────────────────────────────────
function AddCourseModal({ onClose, onCourseAdded }: { onClose: () => void; onCourseAdded: () => void }) {
  const [syllabus, setSyllabus] = useState(['', '', '']);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const loggedIn = Boolean(getToken());

  const addSyllabus = () => setSyllabus(p => [...p, '']);
  const updateSyllabus = (i: number, v: string) => setSyllabus(p => p.map((x, idx) => idx === i ? v : x));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    // Təlim göndərmə və fayl yükləmə artıq hesaba bağlıdır. Bunu formanı
    // doldurduqdan SONRA serverdən öyrənmək pis təcrübədir — burada dərhal deyilir.
    if (!getToken()) {
      setErrors(['Təlim göndərmək üçün daxil olun. Giriş düyməsi səhifənin yuxarısındadır.']);
      setLoading(false);
      return;
    }

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
        // API kontraktı: yalnız icazəli token adları; dizayn sistemində vurğu brend rəngidir.
        accentColor: DEFAULT_COURSE_ACCENT,
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
    <Modal open onClose={onClose} title="Təlimini platformaya əlavə et" kicker="KIBERAZ.AZ" size="lg">
      {submitted ? (
        <div className="auth-success">
          <div className="auth-success__icon"><Send size={24} /></div>
          <h3>Göndərildi!</h3>
          <p>Təliminiz qeydə alındı və <strong>moderasiya növbəsinə</strong> düşdü. Admin təsdiqlədikdən sonra saytda görünəcək.</p>
          <Button variant="primary" onClick={onClose}>Bağla</Button>
        </div>
      ) : (
        <form className="course-form" onSubmit={handleSubmit}>
          {!loggedIn && (
            <div className="notice notice--info" role="status">
              <ShieldCheck size={16} />
              <span>Təlim təklifi göndərmək üçün hesabla daxil olmalısınız — bu, təklifin sizin adınıza qeyd olunması üçün lazımdır.</span>
            </div>
          )}

          <div className="form-section">Müəllim məlumatları</div>
          <div className="form-grid form-grid--2">
            <FormField id="instructor" label="Müəllim adı" required><input id="instructor" className="input" type="text" placeholder="Ad Soyad" required /></FormField>
            <FormField id="role" label="Vəzifə" required><input id="role" className="input" type="text" placeholder="Senior Security Engineer" required /></FormField>
          </div>
          <div className="form-grid form-grid--3">
            <FormField id="company" label="Şirkət"><input id="company" className="input" type="text" placeholder="Şirkət adı" /></FormField>
            <FormField id="linkedin" label="LinkedIn URL"><input id="linkedin" className="input" type="url" placeholder="https://linkedin.com/in/..." /></FormField>
            <FormField id="github" label="GitHub URL"><input id="github" className="input" type="url" placeholder="https://github.com/..." /></FormField>
          </div>
          <FormField id="photoFile" label="Müəllim şəkli" hint="PNG, JPG, WEBP — maksimum 2MB">
            <input id="photoFile" className="input" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
          </FormField>

          <div className="form-section">Təlim məlumatları</div>
          <div className="form-grid form-grid--2">
            <FormField id="courseTitle" label="Təlim başlığı" required><input id="courseTitle" className="input" type="text" placeholder="Web Application Pentesting" required /></FormField>
            <FormField id="kicker" label="Üst başlıq (kicker)"><input id="kicker" className="input" type="text" placeholder="YENİ QRUP: 15 OKTYABR" /></FormField>
          </div>
          <div className="form-grid form-grid--3">
            <FormField id="duration" label="Müddət" required><input id="duration" className="input" type="text" placeholder="8 həftə" required minLength={2} /></FormField>
            <FormField id="level" label="Səviyyə" required>
              <select id="level" className="select" required defaultValue="">
                <option value="">Seçin...</option>
                <option>Başlanğıc</option><option>Başlanğıc → Orta</option>
                <option>Orta</option><option>Orta → Peşəkar</option><option>Peşəkar</option>
              </select>
            </FormField>
            <FormField id="lang" label="Dil">
              <select id="lang" className="select"><option>Azərbaycan dili</option><option>İngilis dili</option><option>Rus dili</option></select>
            </FormField>
          </div>
          <FormField id="syllabusFile" label="Təlim sillabusu" hint="PDF — maksimum 10MB">
            <input id="syllabusFile" className="input" type="file" accept="application/pdf" onChange={e => setSyllabusFile(e.target.files?.[0] || null)} />
          </FormField>
          <FormField id="description" label="Təlim açıqlaması" required>
            <textarea id="description" className="textarea" rows={3} placeholder="Təlimin məzmunu, hədəf auditoriyası..." required />
          </FormField>
          <div className="form-grid form-grid--2">
            <FormField id="contactEmail" label="E-poçt (Gmail)"><input id="contactEmail" className="input" type="email" placeholder="təlim@gmail.com" /></FormField>
            <FormField id="contactPhone" label="Əlaqə nömrəsi"><input id="contactPhone" className="input" type="tel" placeholder="+994 XX XXX XX XX" /></FormField>
          </div>

          <div className="field">
            <span className="field__label" id="syllabus-label">Proqram mövzuları</span>
            <div className="syllabus-inputs" role="group" aria-labelledby="syllabus-label">
              {syllabus.map((s, i) => (
                <div key={i} className="syllabus-input-row">
                  <span className="syllabus-input-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <input type="text" className="input" value={s} onChange={e => updateSyllabus(i, e.target.value)} placeholder={`Mövzu ${i + 1}...`} aria-label={`Mövzu ${i + 1}`} />
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addSyllabus}><Plus size={13} /> Mövzu əlavə et</Button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="notice notice--danger" role="alert" aria-live="assertive">
              <ul>{errors.map((msg, i) => <li key={i}>{msg}</li>)}</ul>
            </div>
          )}

          <div className="modal__actions modal__actions--between">
            <span className="modal__note">* Mütləq doldurulmalı olan sahələr.</span>
            <div className="auth-form__actions">
              <Button variant="outline" onClick={onClose}>Ləğv et</Button>
              <Button type="submit" variant="primary" loading={loading}><Send size={14} /> Göndər</Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ── Course Details Modal ──────────────────────────────────────
function CourseDetailsModal({ ad, onClose }: { ad: CourseAdUI; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={ad.courseTitle} kicker={ad.kicker} size="md" closeOnBackdrop>
      <div className="course-details">
        <div className="course-details__instructor">
          <InstructorAvatar ad={ad} size="lg" />
          <div className="course-details__who">
            <div className="course-details__name">{ad.instructor}</div>
            <div className="course-details__role">{ad.role}{ad.company ? ` · ${ad.company}` : ''}</div>
            {(isSafeExternalLink(ad.socials?.linkedin) || isSafeExternalLink(ad.socials?.github)) && (
              <div className="course-details__socials">
                {isSafeExternalLink(ad.socials?.linkedin) && <a href={ad.socials?.linkedin} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm" aria-label="LinkedIn profili"><IconLinkedin size={13} /> LinkedIn</a>}
                {isSafeExternalLink(ad.socials?.github) && <a href={ad.socials?.github} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm" aria-label="GitHub profili"><IconGithub size={13} /> GitHub</a>}
              </div>
            )}
          </div>
        </div>

        <p className="course-details__desc">{ad.description}</p>

        <div className="course-meta">
          <span className="tag"><Clock size={13} /> {ad.duration}</span>
          <span className="tag"><BarChart2 size={13} /> {ad.level}</span>
          <span className="tag"><Globe size={13} /> {ad.language}</span>
          {ad.contactEmail && <span className="tag"><Mail size={13} /> {ad.contactEmail}</span>}
          {ad.contactPhone && <span className="tag"><Phone size={13} /> {ad.contactPhone}</span>}
        </div>

        <div className="notice notice--success">
          <ShieldCheck size={16} />
          <span>Bu təlim admin tərəfindən yoxlanılıb və təsdiqlənib; yalnız təsdiqlənmiş təlimlər platformada görünür.</span>
        </div>

        {ad.syllabus.length > 0 && (
          <div className="course-syllabus">
            <div className="course-syllabus__title"><BookOpen size={14} /> Tam proqram <span className="tab__count">({ad.syllabus.length} mövzu)</span></div>
            <ol className="list course-syllabus__list">
              {ad.syllabus.map((s, i) => (
                <li key={i} className="list__row">
                  <span className="list__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="list__main"><span className="list__title">{s}</span></span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="modal__actions">
          <Button variant="outline" onClick={onClose}>Bağla</Button>
          {ad.syllabusFile && (
            <ButtonLink href={ad.syllabusFile} target="_blank" rel="noreferrer" variant="primary">
              <FileText size={15} /> Sillabusu PDF yüklə
            </ButtonLink>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Kurs kartı ────────────────────────────────────────────────
function CourseCard({ ad, onDetails }: { ad: CourseAdUI; onDetails: () => void }) {
  const shownTopics = ad.syllabus.slice(0, 3);
  return (
    <article className="course-card" style={{ '--accent': ad.accentColor } as React.CSSProperties}>
      <div className="course-card__top">
        <span className="kicker course-card__kicker">{ad.kicker}</span>
        <span className="badge badge--outline"><BarChart2 size={12} /> {ad.level}</span>
      </div>
      <h3 className="course-card__title">{ad.courseTitle}</h3>
      <div className="course-card__instructor">
        <InstructorAvatar ad={ad} />
        <div className="course-card__who">
          <span className="course-card__name">{ad.instructor}</span>
          <span className="course-card__role">{ad.role}{ad.company ? ` · ${ad.company}` : ''}</span>
        </div>
      </div>
      <p className="course-card__desc">{ad.description}</p>
      <div className="course-meta">
        <span className="tag"><Clock size={12} /> {ad.duration}</span>
        <span className="tag"><Globe size={12} /> {ad.language}</span>
        {ad.syllabus.length > 0 && <span className="tag"><BookOpen size={12} /> {ad.syllabus.length} mövzu</span>}
      </div>
      {shownTopics.length > 0 && (
        <ul className="course-card__topics" aria-label="Proqram mövzuları">
          {shownTopics.map((t, i) => <li key={i}>{t}</li>)}
          {ad.syllabus.length > shownTopics.length && <li className="course-card__more">+{ad.syllabus.length - shownTopics.length} mövzu</li>}
        </ul>
      )}
      <div className="course-card__actions">
        <Button variant="primary" size="sm" onClick={onDetails}>Ətraflı <ArrowRight size={14} /></Button>
        {ad.syllabusFile && (
          <ButtonLink href={ad.syllabusFile} target="_blank" rel="noreferrer" variant="outline" size="sm">
            <FileText size={13} /> Sillabus (PDF)
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function HeroSlider() {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  // ── API-dan təlimləri çəkmək ──────────────────────────────────
  const loader = useCallback(async (): Promise<CourseAdUI[]> => {
    const result = await getApprovedCourses();
    if (!result.success || !result.data) throw new Error(result.message || 'Təlimlər yüklənmədi.');
    return result.data.map(mapCourseToUI);
  }, []);
  const { state, reload } = useAsyncData(loader);

  const courses = state.status === 'ready' ? state.data : [];
  const details = detailsId ? courses.find(c => c.id === detailsId) ?? null : null;

  return (
    <section id="home" className="courses page-section" aria-labelledby="courses-heading">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="kicker">Təlimlər</div>
            <h2 id="courses-heading">Azərbaycanın kibertəhlükəsizlik təlimləri</h2>
            <p>Peşəkar müəllimlərin platformada təqdim etdiyi, admin tərəfindən təsdiqlənmiş təlim proqramları.</p>
          </div>
          <Button variant="outline" onClick={() => setModalOpen(true)} id="course-add-btn">
            <Plus size={15} /> Təlim əlavə et
          </Button>
        </div>

        {state.status === 'loading' && (
          <div className="courses__grid" aria-busy="true">
            <div className="card card--pad"><SkeletonList rows={3} /></div>
            <div className="card card--pad"><SkeletonList rows={3} /></div>
            <div className="card card--pad"><SkeletonList rows={3} /></div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="card">
            <ErrorState title="Təlimlər yüklənmədi" text="Serverlə əlaqə yaradıla bilmədi. Bir az sonra yenidən cəhd edin." onRetry={reload} />
          </div>
        )}

        {state.status === 'ready' && courses.length === 0 && (
          <div className="card">
            <EmptyState
              icon={<BookOpen size={20} />}
              title="Hələ ki təlim əlavə olunmayıb"
              text="İlk təliminizi platformaya əlavə edin — admin təsdiqindən sonra burada görünəcək."
              action={<Button variant="primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Təlim əlavə et</Button>}
            />
          </div>
        )}

        {state.status === 'ready' && courses.length > 0 && (
          <div className="courses__grid">
            {courses.map(ad => <CourseCard key={ad.id} ad={ad} onDetails={() => setDetailsId(ad.id)} />)}
          </div>
        )}
      </div>

      {modalOpen && <AddCourseModal onClose={() => setModalOpen(false)} onCourseAdded={reload} />}
      {details && <CourseDetailsModal ad={details} onClose={() => setDetailsId(null)} />}
    </section>
  );
}
