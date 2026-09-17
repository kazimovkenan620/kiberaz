import { useCallback, useState } from 'react';
import {
  AlertTriangle, BookOpen, Calendar, CheckCircle, Clock, Crown, Edit3, Plus, RefreshCw, RotateCcw, Save, Trash2, XCircle,
} from 'lucide-react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  createCourse, deleteMyCourse, getMyCourses, getVipStatus, reactivateCourse, updateCourse,
  type CreateCourseRequest, type MyCourse, type MyCourseStatus, type VipStatus,
} from '../services/courseService';
import CourseForm from './CourseForm';
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, ErrorState, Modal, ProgressBar, SkeletonList, StatCard } from './ui';
import './MyCoursesTab.css';

// ─── Kabinet · Təlimlərim (VIP) ───────────────────────────────
// Sahib öz təlimlərini burada idarə edir: müddət (30 gün), status, redaktə (admin təsdiqi ilə),
// silmə (təsdiq dialoqu), passiv təlimi yenidən aktivləşdirmə (aktiv VIP dövrü + kredit).
// Bütün qaydalar serverdədir; buradakı düymələr yalnız serverin bildirdiyi imkanları göstərir.

const STATUS: Record<MyCourseStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  Approved: { label: 'Aktiv', tone: 'success' },
  Pending: { label: 'Təsdiq gözləyir', tone: 'warning' },
  Rejected: { label: 'Rədd edilib', tone: 'danger' },
  Expired: { label: 'Passiv', tone: 'neutral' },
};

const formatDay = (iso: string | null | undefined) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—';

type Toast = (msg: string, type: 'success' | 'error') => void;

function VipCard({ vip, onNew }: { vip: VipStatus | null; onNew: () => void }) {
  if (!vip) return null;
  const canShare = vip.hasVipRole && vip.hasActiveTerm && vip.coursesRemaining > 0;
  const usedPct = vip.courseAllowance ? (vip.coursesUsed / vip.courseAllowance) * 100 : 0;
  return (
    <Card tone={vip.hasActiveTerm ? 'brand' : undefined} className="mc-vip">
      <CardHead icon={<Crown size={15} />} title="VIP üzvlük"
        action={<Badge tone={vip.hasActiveTerm ? 'success' : 'neutral'} dot>{vip.hasActiveTerm ? 'Aktiv dövr' : 'Aktiv dövr yoxdur'}</Badge>} />
      {vip.hasActiveTerm ? (
        <div className="mc-vip__body">
          <div className="mc-vip__row"><Calendar size={14} /> <span>{formatDay(vip.termStartsAt)} — {formatDay(vip.termEndsAt)} · <strong>{vip.termDaysLeft} gün</strong> qalıb</span></div>
          <div className="mc-vip__quota">
            <div className="mc-vip__quota-row">
              <span>Bu dövrün təlim hüququ</span>
              <span><strong>{vip.coursesUsed}</strong> / {vip.courseAllowance} istifadə olunub</span>
            </div>
            <ProgressBar value={usedPct} label={`Bu dövrdə ${vip.coursesUsed} / ${vip.courseAllowance} təlim paylaşılıb`} size="sm" tone={canShare ? 'brand' : 'warning'} />
          </div>
          {canShare
            ? <p className="note">Bu dövrdə daha <strong>{vip.coursesRemaining}</strong> təlim paylaşa bilərsiniz. Təlim admin təsdiqindən sonra {vip.courseActiveDays} gün aktiv qalır — VIP dövrü ondan əvvəl bitsə belə.</p>
            : <p className="note">Bu dövrün təlim hüququ istifadə olunub. <strong>Növbəti VIP ödənişinə qədər yeni təlim əlavə edilə bilməz</strong>; eyni dövrdə əlavə təlim əlavə ödəniş tələb edir (ödəniş sistemi tezliklə).</p>}
        </div>
      ) : (
        <p className="note">
          {vip.hasVipRole
            ? 'VIP dövrünüz bitib. Yeni təlim paylaşmaq və passiv təlimi yenidən aktivləşdirmək üçün VIP üzvlüyü yeniləyin.'
            : 'Təlim paylaşmaq yalnız VIP hesablar üçündür. VIP üzvlük 30 gün davam edir və hər dövr 1 təlim paylaşma hüququ verir.'}
        </p>
      )}
      <div className="mc-vip__actions">
        <Button variant="primary" onClick={onNew} disabled={!canShare}><Plus size={15} /> Yeni təlim paylaş</Button>
      </div>
    </Card>
  );
}

function CourseRow({ course, busy, onEdit, onDelete, onReactivate }: {
  course: MyCourse; busy: boolean; onEdit: () => void; onDelete: () => void; onReactivate: () => void;
}) {
  const st = STATUS[course.status];
  const total = 30;
  const left = course.daysLeft ?? 0;
  return (
    <article className="mc-course" aria-label={course.courseTitle}>
      <div className="mc-course__head">
        <div className="mc-course__title">
          <h3>{course.courseTitle}</h3>
          <span className="text-3 text-sm">{course.instructorName} · {course.duration} · {course.level}</span>
        </div>
        <div className="mc-course__badges">
          <Badge tone={st.tone} dot>{st.label}</Badge>
          {course.hasPendingRevision && <Badge tone="warning"><Clock size={12} /> Dəyişiklik təsdiq gözləyir</Badge>}
        </div>
      </div>

      {course.status === 'Approved' && course.expiresAt && (
        <div className="mc-course__term">
          <div className="mc-course__term-row">
            <span><Calendar size={13} /> Saytda: {formatDay(course.publishedAt)} — {formatDay(course.expiresAt)}</span>
            <span><strong>{left}</strong> gün qalıb</span>
          </div>
          <ProgressBar value={Math.min(100, ((total - left) / total) * 100)} label={`Aktiv müddət: ${left} gün qalıb`} size="sm" tone={left <= 5 ? 'warning' : 'success'} />
        </div>
      )}
      {course.status === 'Expired' && (
        <p className="mc-course__hint"><AlertTriangle size={13} /> Aktiv müddət {formatDay(course.expiresAt)} tarixində bitib; təlim saytdan çıxarılıb. Yenidən aktivləşdirmək üçün aktiv VIP dövrü və kredit lazımdır.</p>
      )}
      {course.status === 'Pending' && (
        <p className="mc-course__hint"><Clock size={13} /> {course.publishedAt ? 'Yenidən aktivləşdirmə sorğusu admin təsdiqi gözləyir; təsdiqdən sonra 30 gün aktiv olacaq.' : 'Admin təsdiqi gözlənilir; təsdiqdən sonra təlim 30 gün saytda görünəcək.'}</p>
      )}
      {course.status === 'Rejected' && (
        <p className="mc-course__hint"><XCircle size={13} /> Admin bu təlimi rədd edib. Məzmunu düzəldib yenidən göndərə bilərsiniz.</p>
      )}
      {course.hasPendingRevision && course.pendingRevision && (
        <p className="mc-course__hint"><Clock size={13} /> {formatDay(course.pendingRevision.submittedAt)} tarixli dəyişiklik admin təsdiqinə qədər saytda görünmür; saytda əvvəlki versiya qalır.</p>
      )}

      <div className="mc-course__actions">
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}><Edit3 size={13} /> Redaktə et</Button>
        {course.status === 'Expired' && (
          <Button variant="primary" size="sm" onClick={onReactivate} disabled={busy || !course.canReactivate}
            title={course.canReactivate ? undefined : 'Aktiv VIP dövrü və qalan kredit tələb olunur'}>
            <RotateCcw size={13} /> Yenidən aktivləşdir
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={onDelete} disabled={busy} aria-label={`${course.courseTitle} təlimini sil`}><Trash2 size={13} /> Sil</Button>
      </div>
    </article>
  );
}

export default function MyCoursesTab({ onToast }: { onToast: Toast }) {
  const [editing, setEditing] = useState<MyCourse | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MyCourse | null>(null);
  const [pendingReactivate, setPendingReactivate] = useState<MyCourse | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loader = useCallback(async () => {
    const [courses, vip] = await Promise.all([getMyCourses(), getVipStatus()]);
    if (!courses.success || !courses.data) throw new Error(courses.errors?.[0] || courses.message || 'Təlimlər yüklənmədi.');
    return { courses: courses.data, vip: vip.success && vip.data ? vip.data : null };
  }, []);
  const { state, reload } = useAsyncData(loader);
  const courses = state.status === 'ready' ? state.data.courses : [];
  const vip = state.status === 'ready' ? state.data.vip : null;

  const active = courses.filter(c => c.status === 'Approved').length;
  const pending = courses.filter(c => c.status === 'Pending' || c.hasPendingRevision).length;
  const passive = courses.filter(c => c.status === 'Expired').length;

  const run = async (id: number, action: () => Promise<{ success: boolean; message: string; errors?: string[] }>) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      const res = await action();
      if (res.success) { onToast(res.message || 'Əməliyyat tamamlandı.', 'success'); reload(); }
      else onToast(res.errors?.[0] || res.message || 'Xəta baş verdi.', 'error');
    } catch { onToast('Serverlə əlaqə yaradıla bilmədi.', 'error'); }
    finally { setBusyId(null); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await run(pendingDelete.id, () => deleteMyCourse(pendingDelete.id));
    setPendingDelete(null);
  };
  const confirmReactivate = async () => {
    if (!pendingReactivate) return;
    await run(pendingReactivate.id, () => reactivateCourse(pendingReactivate.id));
    setPendingReactivate(null);
  };

  // Redaktə formasının başlanğıc dəyərləri: gözləyən dəyişiklik varsa ONU açırıq (sahib son
  // göndərdiyini görsün), yoxdursa canlı məzmunu.
  const editInitial = (course: MyCourse) => {
    const src = course.pendingRevision ?? course;
    return {
      instructorName: src.instructorName, instructorRole: src.instructorRole, instructorCompany: src.instructorCompany ?? '',
      linkedInUrl: src.linkedInUrl ?? '', gitHubUrl: src.gitHubUrl ?? '', contactEmail: src.contactEmail ?? '',
      contactPhone: src.contactPhone ?? '', courseTitle: src.courseTitle, kicker: src.kicker ?? '', description: src.description,
      duration: src.duration, level: src.level, language: src.language, syllabusTopics: src.syllabusTopics,
      instructorPhotoUrl: src.instructorPhotoUrl ?? undefined, syllabusFileUrl: src.syllabusFileUrl ?? undefined,
    };
  };

  return (
    <div className="ud-section mc">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">Kabinet</span>
          <h1 className="page-header__title">Təlimlərim</h1>
          <p className="page-header__lead">Paylaşdığınız təlimlərin müddəti, statusu və dəyişiklikləri. Hər dəyişiklik admin təsdiqindən keçir.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload} aria-label="Siyahını yenilə"><RefreshCw size={14} /></Button>
      </div>

      <div className="stat-grid">
        <StatCard icon={<CheckCircle size={18} />} tone="success" value={active} label="Aktiv təlim" />
        <StatCard icon={<Clock size={18} />} tone="warning" value={pending} label="Təsdiq gözləyən" />
        <StatCard icon={<BookOpen size={18} />} tone="info" value={passive} label="Passiv" />
      </div>

      <VipCard vip={vip} onNew={() => setCreating(true)} />

      <Card padded={false}>
        <div className="mc-table-head">
          <h3 className="card__title" style={{ marginBottom: 0 }}><BookOpen size={15} /> Təlimlər</h3>
          <span className="text-3 text-xs">{courses.length} qeyd</span>
        </div>
        {state.status === 'loading' && <div className="card--pad"><SkeletonList rows={3} /></div>}
        {state.status === 'error' && <ErrorState title="Təlimlər yüklənmədi" text={state.message} onRetry={reload} />}
        {state.status === 'ready' && courses.length === 0 && (
          <EmptyState icon={<BookOpen size={20} />} title="Hələ təlim paylaşmamısınız"
            text={vip?.hasActiveTerm ? 'İlk təliminizi paylaşın — admin təsdiqindən sonra 30 gün saytda görünəcək.' : 'Təlim paylaşmaq üçün aktiv VIP üzvlük lazımdır.'} />
        )}
        {state.status === 'ready' && courses.length > 0 && (
          <div className="mc-list">
            {courses.map(course => (
              <CourseRow key={course.id} course={course} busy={busyId === course.id}
                onEdit={() => setEditing(course)}
                onDelete={() => setPendingDelete(course)}
                onReactivate={() => setPendingReactivate(course)} />
            ))}
          </div>
        )}
      </Card>

      {creating && (
        <Modal open onClose={() => setCreating(false)} title="Yeni təlim paylaş" kicker="VIP" size="lg">
          <CourseForm
            submitLabel="Göndər"
            notice={<div className="notice notice--info" role="status"><Crown size={16} /><span>Təlim admin təsdiqindən sonra {vip?.courseActiveDays ?? 30} gün saytda qalır. Bu dövrün {vip?.coursesRemaining ?? 0} / {vip?.courseAllowance ?? 1} təlim hüququndan biri istifadə olunacaq.</span></div>}
            onCancel={() => setCreating(false)}
            onSubmit={async (request: CreateCourseRequest) => {
              const res = await createCourse(request);
              if (res.success) { onToast(res.message, 'success'); setCreating(false); reload(); }
              return res;
            }}
          />
        </Modal>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Təlimi redaktə et" kicker={editing.courseTitle} size="lg">
          <CourseForm
            initial={editInitial(editing)}
            submitLabel="Yadda saxla və təsdiqə göndər"
            submitIcon={<Save size={14} />}
            notice={
              <div className="notice notice--info" role="status">
                <Clock size={16} />
                <span>{editing.status === 'Approved'
                  ? 'Dəyişiklik admin təsdiqinə göndəriləcək. Təsdiqlənənə qədər saytda əvvəlki versiya qalır; aktiv müddət (30 gün) dəyişmir.'
                  : 'Dəyişiklik admin təsdiqindən sonra qüvvəyə minir.'}</span>
              </div>
            }
            onCancel={() => setEditing(null)}
            onSubmit={async (request: CreateCourseRequest) => {
              const res = await updateCourse(editing.id, request);
              if (res.success) { onToast(res.message, 'success'); setEditing(null); reload(); }
              return res;
            }}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Təlimi silmək istədiyinizə əminsiniz?"
        confirmLabel="Bəli, sil"
        icon={<Trash2 size={14} />}
        busy={busyId !== null}
        onCancel={() => { if (busyId === null) setPendingDelete(null); }}
        onConfirm={() => void confirmDelete()}
      >
        {pendingDelete && <><strong>«{pendingDelete.courseTitle}»</strong> təlimi saytdan və kabinetdən silinəcək. Bu əməliyyat geri qaytarıla bilməz və istifadə olunmuş VIP krediti geri qayıtmır.</>}
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingReactivate !== null}
        title="Təlimi yenidən aktivləşdirmək istəyirsiniz?"
        confirmLabel="Bəli, göndər"
        tone="primary"
        icon={<RotateCcw size={14} />}
        busy={busyId !== null}
        onCancel={() => { if (busyId === null) setPendingReactivate(null); }}
        onConfirm={() => void confirmReactivate()}
      >
        {pendingReactivate && <><strong>«{pendingReactivate.courseTitle}»</strong> admin təsdiqinə göndəriləcək və bu VIP dövrünün 1 təlim hüququ istifadə olunacaq. Təsdiqdən sonra təlim yenidən 30 gün aktiv olacaq.</>}
      </ConfirmDialog>
    </div>
  );
}
