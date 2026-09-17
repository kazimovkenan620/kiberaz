import { useCallback, useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { ArrowRight, BarChart2, BookOpen, Check, Clock, Crown, FileText, Globe, Mail, Phone, Plus, Send, ShieldCheck } from 'lucide-react';
import { createCourse, getApprovedCourses, getVipStatus, resolveUploadUrl, type CourseResponse, type CreateCourseRequest, type VipStatus } from '../services/courseService';
import { getStoredUserRoles, getToken } from '../services/authService';
import { courseAccentColor } from '../utils/courseAccent';
import CourseForm from './CourseForm';
import { Button, ButtonLink, EmptyState, ErrorState, Modal, SkeletonList } from './ui';
import './HeroSlider.css';

// ─── Təlimlər (kurs kəşfi) ────────────────────────────────────
// Əvvəlki avtomatik karusel sakit kart şəbəkəsi ilə əvəz edilib: kartda yalnız
// skan edilə bilən əsas məlumat, tam təfərrüat detal pəncərəsindədir.
// Backend məlumatının heç bir sahəsi itirilməyib (müəllim, sosial linklər,
// əlaqə, müddət, səviyyə, dil, mövzular, sillabus PDF, detal, kurs əlavə etmə).

const formatDay = (iso: string | null) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—';

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
  return {
    id: String(course.id),
    kicker: course.kicker || 'YENİ TƏLİM',
    instructor: course.instructorName,
    instructorInitials: course.instructorInitials,
    role: course.instructorRole,
    company: course.instructorCompany || '',
    instructorPhoto: resolveUploadUrl(course.instructorPhotoUrl),
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
    syllabusFile: resolveUploadUrl(course.syllabusFileUrl),
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
// Təlimi yalnız VIP hesab paylaşa bilər (aktiv 30 günlük dövr + dövrdə 1 kredit). Burada göstərilən
// vəziyyət serverin /course/vip-status cavabıdır; həqiqi qərar serverdə, yazı anında verilir.
function AddCourseModal({ onClose, onCourseAdded }: { onClose: () => void; onCourseAdded: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const loggedIn = Boolean(getToken());
  const isVip = getStoredUserRoles().some(r => r.toLowerCase() === 'vip');

  const statusLoader = useCallback(async (): Promise<VipStatus | null> => {
    if (!getToken()) return null;
    const result = await getVipStatus();
    return result.success && result.data ? result.data : null;
  }, []);
  const { state: statusState } = useAsyncData(statusLoader);
  const vip = statusState.status === 'ready' ? statusState.data : null;
  const canShare = Boolean(vip?.hasVipRole && vip.hasActiveTerm && vip.coursesRemaining > 0);

  const submit = async (request: CreateCourseRequest) => {
    const result = await createCourse(request);
    if (result.success) { setSubmitted(true); onCourseAdded(); }
    return result;
  };

  const gate = (() => {
    if (!loggedIn) return (
      <div className="notice notice--info" role="status">
        <ShieldCheck size={16} />
        <span>Təlim paylaşmaq üçün hesabla daxil olmalısınız — bu funksiya yalnız VIP hesablar üçündür.</span>
      </div>
    );
    if (!isVip || (vip && !vip.hasVipRole)) return (
      <div className="notice notice--warning" role="status">
        <Crown size={16} />
        <span>Təlim paylaşmaq yalnız <strong>VIP</strong> hesablar üçündür. VIP üzvlük 30 gün davam edir və hər dövr 1 təlim paylaşma hüququ verir.</span>
      </div>
    );
    if (vip && !vip.hasActiveTerm) return (
      <div className="notice notice--warning" role="status">
        <Crown size={16} />
        <span>Aktiv VIP dövrünüz yoxdur. Yeni təlim paylaşmaq üçün VIP üzvlüyü yeniləyin.</span>
      </div>
    );
    if (vip && vip.coursesRemaining <= 0) return (
      <div className="notice notice--warning" role="status">
        <Crown size={16} />
        <span>Bu VIP dövründə {vip.courseAllowance} təlim paylaşılıb. Növbəti VIP ödənişinə qədər yeni təlim əlavə edilə bilməz; eyni dövrdə əlavə təlim əlavə ödəniş tələb edir (ödəniş sistemi tezliklə).</span>
      </div>
    );
    if (vip) return (
      <div className="notice notice--success" role="status">
        <Crown size={16} />
        <span>VIP dövrü {formatDay(vip.termEndsAt)} tarixinədək aktivdir · bu dövrdə <strong>{vip.coursesRemaining} / {vip.courseAllowance}</strong> təlim hüququ qalıb. Təlim admin təsdiqindən sonra <strong>{vip.courseActiveDays} gün</strong> saytda qalır, sonra passivə düşür; kabinetdən idarə edə bilərsiniz.</span>
      </div>
    );
    return null;
  })();

  return (
    <Modal open onClose={onClose} title="Təlimini platformaya əlavə et" kicker="KIBERAZ.AZ · VIP" size="lg">
      {submitted ? (
        <div className="auth-success">
          <div className="auth-success__icon"><Send size={24} /></div>
          <h3>Göndərildi!</h3>
          <p>Təliminiz qeydə alındı və <strong>moderasiya növbəsinə</strong> düşdü. Admin təsdiqlədikdən sonra 30 gün saytda görünəcək; müddəti və dəyişiklikləri kabinetdəki <strong>Təlimlərim</strong> bölməsindən idarə edin.</p>
          <Button variant="primary" onClick={onClose}>Bağla</Button>
        </div>
      ) : (
        <CourseForm
          notice={gate}
          disabled={!loggedIn || !isVip || !canShare}
          submitLabel="Göndər"
          onCancel={onClose}
          onSubmit={submit}
        />
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
      <div className="course-card__visual" aria-hidden="true">
        <span className="course-card__visual-kicker">KIBERAZ.AZ TƏLİMİ</span>
        <div className="course-card__visual-media">
          <span className="course-card__visual-icon"><ShieldCheck size={28} strokeWidth={1.5} /></span>
          <div className={`course-card__visual-photo${ad.instructorPhoto ? '' : ' course-card__visual-photo--placeholder'}`}>
            {ad.instructorPhoto
              ? <img src={ad.instructorPhoto} alt="" />
              : <span>{ad.instructorInitials}</span>}
          </div>
        </div>
        <strong>{ad.instructor}</strong>
        <span>{ad.role}{ad.company ? ` · ${ad.company}` : ''}</span>
      </div>

      <div className="course-card__content">
        <div className="course-card__top">
          <span className="kicker course-card__kicker">{ad.kicker}</span>
          <span className="course-card__status"><ShieldCheck size={13} /> Təlim elanı</span>
        </div>
        <h3 className="course-card__title">{ad.courseTitle}</h3>
        <p className="course-card__desc">{ad.description}</p>

        <div className="course-meta course-card__meta">
          <span className="tag"><Clock size={12} /> {ad.duration}</span>
          <span className="tag"><BarChart2 size={12} /> {ad.level}</span>
          <span className="tag"><Globe size={12} /> {ad.language}</span>
          {ad.syllabus.length > 0 && <span className="tag"><BookOpen size={12} /> {ad.syllabus.length} mövzu</span>}
        </div>

        {shownTopics.length > 0 && (
          <div className="course-card__program">
          <h4>Təlimdə nələr öyrənəcəksiniz?</h4>
          <ul className="course-card__topics" aria-label="Təlimdə öyrənəcəkləriniz">
            {shownTopics.map((topic, index) => <li key={index}><Check size={13} /> {topic}</li>)}
          </ul>
          </div>
        )}

        <div className="course-card__footer">
          <div className="course-card__instructor">
            <InstructorAvatar ad={ad} />
            <div className="course-card__who">
              <span className="course-card__name">{ad.instructor}</span>
              <span className="course-card__role">{ad.role}{ad.company ? ` · ${ad.company}` : ''}</span>
            </div>
          </div>
          <div className="course-card__actions">
            {ad.syllabusFile && (
              <ButtonLink href={ad.syllabusFile} target="_blank" rel="noreferrer" variant="outline" size="sm">
                <FileText size={13} /> Sillabus
              </ButtonLink>
            )}
            <Button variant="primary" onClick={onDetails}>Proqram və əlaqə <ArrowRight size={15} /></Button>
          </div>
        </div>
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
        <div className="courses__showcase">
        <div className="courses__intro">
          <div className="courses__intro-copy">
            <div className="kicker">KIBERAZ.AZ / TƏLİMLƏR</div>
            <h2 id="courses-heading">Kibertəhlükəsizlikdə ilk addımın<br /><span>buradan başlayır.</span></h2>
            <p>Təlimçilərlə tanış ol, proqramları müqayisə et və sənə uyğun təlimi seç.</p>
          </div>

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
              text="VIP hesabla ilk təliminizi platformaya əlavə edin — admin təsdiqindən sonra 30 gün burada görünəcək."
              action={<Button variant="primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Təlim əlavə et</Button>}
            />
          </div>
        )}

        {state.status === 'ready' && courses.length > 0 && (
          <div className="courses__grid">
            {courses.map(ad => <CourseCard key={ad.id} ad={ad} onDetails={() => setDetailsId(ad.id)} />)}
          </div>
        )}
        <aside className="courses__publisher" aria-labelledby="courses-teachers-heading">
          <span className="courses__invitation-symbol" aria-hidden="true"><BookOpen size={24} /></span>
          <div>
            <h3 id="courses-teachers-heading">Öyrədəcəyin bilik var? Onu axtaran tələbələr də var.</h3>
            <p>Müəllimlər və təlim mərkəzləri: təlim proqramınızı Kiberaz.az-da təqdim edin.</p>
          </div>
          <Button variant="outline" onClick={() => setModalOpen(true)} id="course-add-btn"><Plus size={16} /> Təlimini paylaş <ArrowRight size={15} /></Button>
        </aside>
        </div>
      </div>

      {modalOpen && <AddCourseModal onClose={() => setModalOpen(false)} onCourseAdded={reload} />}
      {details && <CourseDetailsModal ad={details} onClose={() => setDetailsId(null)} />}
    </section>
  );
}
