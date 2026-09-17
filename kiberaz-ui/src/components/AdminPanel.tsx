// ============================================================
// AdminPanel.tsx — Admin idarəetmə bölmələri
//
// Bu fayl ayrıca səhifə deyil: tab komponentləri export edilir və
// UserDashboard (Kabinetim) içində Admin rolu olan istifadəçiyə göstərilir.
//
// TƏHLÜKƏSİZLİK: bu komponentlərin görünməsi heç bir səlahiyyət vermir.
// Bütün api/admin endpoint-ləri serverdə [Authorize(Roles = "Admin")] ilə qorunur.
// ============================================================

import { Fragment, useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Users, ClipboardList, CheckCircle, XCircle, Trash2, Plus, RefreshCw, AlertTriangle,
  ExternalLink, Lock, Unlock, UserPlus, Clock, Layers, ShieldAlert, Crown, Eye, EyeOff, RotateCcw,
  Activity, Calendar, Edit3, Mail, ListChecks, ShieldCheck, Save, UserX, TrendingUp, Award, History,
} from 'lucide-react';
import {
  getAdminCourses, getAdminUsers,
  approveCourse, rejectCourse, deleteCourse, createAdminCourse, updateAdminCourse,
  approveCourseRevision, rejectCourseRevision,
  changeUserRole, toggleUserBlock, startVipTerm, getUserDetail, updateUser, deleteUser, getAdminAudit,
  type AdminStats, type AdminCourse, type AdminUser, type AdminAuditEntry,
} from '../services/adminService';
import { useAsyncData } from '../hooks/useAsyncData';
import CourseForm from './CourseForm';
import type { CreateCourseRequest } from '../services/courseService';
import {
  Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, ErrorState, FormField, Modal, ProgressBar,
  SearchField, SkeletonList, StatCard, Tabs,
} from './ui';
import './AdminPanel.css';

type ToastFn = (msg: string, type: 'success' | 'error') => void;

// ── Dashboard Tab ─────────────────────────────────────────────
// ── Əməliyyat jurnalı (İcmal) ────────────────────────────────
// Kim, nə, nə vaxt, haradan. Admin tokeni oğurlansa belə burada iz qalır; qeydlər silinmir.
const ACTION_LABELS: Record<string, string> = {
  'course.create': 'Təlim əlavə edildi', 'course.approve': 'Təlim təsdiqləndi', 'course.reject': 'Təlim rədd edildi',
  'course.update': 'Təlim redaktə edildi', 'course.delete': 'Təlim silindi',
  'course.revision.approve': 'Dəyişiklik təsdiqləndi', 'course.revision.reject': 'Dəyişiklik rədd edildi',
  'user.update': 'İstifadəçi redaktə edildi', 'user.delete': 'İstifadəçi silindi', 'user.role': 'Rol dəyişdirildi',
  'user.block': 'Blok dəyişdirildi', 'user.vip-term': 'VIP dövrü açıldı',
  'category.create': 'Kateqoriya yaradıldı', 'category.update': 'Kateqoriya redaktə edildi',
  'category.delete': 'Kateqoriya silindi', 'category.restore': 'Kateqoriya bərpa edildi',
  'question.create': 'Sual yaradıldı', 'question.update': 'Sual redaktə edildi',
  'question.delete': 'Sual silindi', 'question.restore': 'Sual bərpa edildi',
};
const actionTone = (action: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' =>
  action.endsWith('.delete') ? 'danger'
  : action.endsWith('.restore') || action.endsWith('.approve') || action.endsWith('.create') ? 'success'
  : action.endsWith('.reject') || action === 'user.block' ? 'warning'
  : action.startsWith('user.') ? 'info' : 'neutral';

function AuditCard() {
  const loader = useCallback(async () => {
    const res = await getAdminAudit(15);
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'Jurnal yüklənmədi.');
    return res.data;
  }, []);
  const { state, reload } = useAsyncData(loader);
  const entries = state.status === 'ready' ? state.data : [];

  return (
    <Card padded={false}>
      <div className="adm-toolbar">
        <h3 className="card__title adm-toolbar__title"><History size={15} /> Son admin əməliyyatları</h3>
        <div className="adm-toolbar__right">
          <Button variant="ghost" size="sm" onClick={reload} aria-label="Jurnalı yenilə"><RefreshCw size={14} /></Button>
        </div>
      </div>
      {state.status === 'loading' && <div className="card--pad"><SkeletonList rows={3} /></div>}
      {state.status === 'error' && <ErrorState title="Jurnal yüklənmədi" text={state.message} onRetry={reload} />}
      {state.status === 'ready' && entries.length === 0 && (
        <EmptyState compact icon={<History size={18} />} title="Hələ qeyd yoxdur" text="Admin panelindən edilən hər dəyişiklik burada iz qoyur." />
      )}
      {state.status === 'ready' && entries.length > 0 && (
        <ul className="adm-audit">
          {entries.map((entry: AdminAuditEntry) => (
            <li key={entry.id} className="adm-audit__row">
              <Badge tone={actionTone(entry.action)}>{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
              <span className="adm-audit__summary">{entry.summary}</span>
              <span className="adm-audit__meta">
                @{entry.actorNickname} · {formatDateTime(entry.at)}{entry.ip ? ` · ${entry.ip}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DashboardTab({ stats, onRefresh, onNavigate }: {
  stats: AdminStats | null;
  onRefresh: () => void;
  /** İcmaldakı "bax" düymələri müvafiq bölməyə keçir (tab id-si UserDashboard-dadır). */
  onNavigate?: (tab: string) => void;
}) {
  const num = (value: number) => value.toLocaleString('az-AZ');

  // Diqqət tələb edən işlər — admin panelə girəndə ilk görməli olduğu şeylər.
  const alerts = stats ? [
    { id: 'adm-courses', tone: 'warning' as const, show: stats.pendingCourses > 0, icon: <Clock size={15} />,
      label: `${num(stats.pendingCourses)} təlim moderasiya gözləyir`, action: 'Təlimlərə bax' },
    { id: 'adm-courses', tone: 'warning' as const, show: stats.expiringSoon > 0, icon: <Calendar size={15} />,
      label: `${num(stats.expiringSoon)} təlimin müddəti 7 gün içində bitir`, action: 'Təlimlərə bax' },
    { id: 'adm-exams', tone: 'info' as const, show: stats.openExamSessions > 0, icon: <ClipboardList size={15} />,
      label: `${num(stats.openExamSessions)} imtahan sessiyası açıqdır`, action: 'Sessiyalara bax' },
    { id: 'adm-users', tone: 'danger' as const, show: stats.blockedUsers > 0, icon: <Lock size={15} />,
      label: `${num(stats.blockedUsers)} hesab bloklanıb`, action: 'İstifadəçilərə bax' },
    { id: 'adm-users', tone: 'neutral' as const, show: stats.unconfirmedUsers > 0, icon: <Mail size={15} />,
      label: `${num(stats.unconfirmedUsers)} hesabın e-poçtu təsdiqlənməyib`, action: 'İstifadəçilərə bax' },
  ].filter(a => a.show) : [];

  const correctRate = stats && stats.totalAnswers > 0
    ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0;
  const roleRows = stats ? Object.entries(stats.usersByRole).filter(([, count]) => count > 0) : [];

  return (
    <div className="adm">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">İdarəetmə paneli</span>
          <h1 className="page-header__title">İcmal</h1>
          <p className="page-header__lead">Platformanın ümumi vəziyyəti — canlı serverdən gələn real rəqəmlər.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw size={14} /> Yenilə</Button>
      </div>

      {!stats ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <div className="stat-grid adm-stats">
            <StatCard icon={<Users size={18} />} tone="info" value={num(stats.totalUsers)} label="İstifadəçi"
              extra={<span className="stat__extra"><UserPlus size={12} /> bu həftə +{num(stats.newUsersThisWeek)}</span>} />
            <StatCard icon={<BookOpen size={18} />} tone="brand" value={num(stats.activeCourses)} label="Saytda aktiv təlim"
              extra={<span className="stat__extra">{num(stats.totalCourses)} ümumi · {num(stats.pendingCourses)} gözləyən</span>} />
            <StatCard icon={<ClipboardList size={18} />} tone="success" value={num(stats.totalExamSessions)} label="İmtahan sessiyası"
              extra={<span className="stat__extra">{num(stats.openExamSessions)} açıq · {num(stats.closedExamSessions)} bağlı</span>} />
            <StatCard icon={<ListChecks size={18} />} tone="warning" value={num(stats.totalQuestions)} label="Sual bankı"
              extra={<span className="stat__extra">{num(stats.totalCategories)} kateqoriya</span>} />
          </div>

          {alerts.length > 0 && (
            <Card className="adm-alerts">
              <CardHead icon={<ShieldAlert size={15} />} title="Diqqət tələb edir" />
              <ul className="adm-alerts__list">
                {alerts.map((alert, index) => (
                  <li key={index} className="adm-alerts__row">
                    <Badge tone={alert.tone} dot>{alert.icon}</Badge>
                    <span className="adm-alerts__label">{alert.label}</span>
                    {onNavigate && (
                      <Button variant="ghost" size="sm" onClick={() => onNavigate(alert.id)}>{alert.action}</Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="adm-grid">
            <Card>
              <CardHead icon={<Users size={15} />} title="Rol bölgüsü"
                action={<Badge tone="warning"><Crown size={11} /> {num(stats.activeVipTerms)} aktiv VIP dövrü</Badge>} />
              {roleRows.length === 0 ? (
                <p className="note">Hələ istifadəçi yoxdur.</p>
              ) : (
                <ul className="adm-bars">
                  {roleRows.map(([role, count]) => (
                    <li key={role} className="adm-bars__row">
                      <span className="adm-bars__label">{ROLE_LABELS[role] ?? role}</span>
                      <ProgressBar value={stats.totalUsers ? (count / stats.totalUsers) * 100 : 0}
                        label={`${ROLE_LABELS[role] ?? role}: ${count} istifadəçi`} size="sm"
                        tone={role === 'VIP' ? 'warning' : role === 'Teacher' ? 'success' : 'brand'} />
                      <span className="adm-bars__value">{num(count)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="note">Bloklanmış: <strong>{num(stats.blockedUsers)}</strong> · e-poçtu təsdiqlənməyən: <strong>{num(stats.unconfirmedUsers)}</strong></p>
            </Card>

            <Card>
              <CardHead icon={<BookOpen size={15} />} title="Təlimlərin vəziyyəti" />
              <ul className="adm-kv">
                <li><span><CheckCircle size={13} /> Aktiv (saytda)</span><strong>{num(stats.activeCourses)}</strong></li>
                <li><span><Clock size={13} /> Moderasiya gözləyən</span><strong>{num(stats.pendingCourses)}</strong></li>
                <li><span><Calendar size={13} /> 7 gün içində bitir</span><strong>{num(stats.expiringSoon)}</strong></li>
                <li><span><RotateCcw size={13} /> Passiv (müddəti bitib)</span><strong>{num(stats.expiredCourses)}</strong></li>
                <li><span><XCircle size={13} /> Rədd edilmiş</span><strong>{num(stats.rejectedCourses)}</strong></li>
              </ul>
            </Card>

            <Card>
              <CardHead icon={<ListChecks size={15} />} title="Sual bankı" />
              <ul className="adm-kv">
                <li><span><Unlock size={13} /> Açıq (quiz) sual</span><strong>{num(stats.publicQuestions)}</strong></li>
                <li><span><Lock size={13} /> Məxfi (imtahan) sual</span><strong>{num(stats.examOnlyQuestions)}</strong></li>
                <li><span><Layers size={13} /> Kateqoriya</span><strong>{num(stats.totalCategories)}</strong></li>
              </ul>
              {stats.examOnlyQuestions === 0 && (
                <p className="note"><AlertTriangle size={13} /> Məxfi sual yoxdur — VIP hesablar imtahan sessiyası yarada bilməz.</p>
              )}
            </Card>

            <Card>
              <CardHead icon={<Activity size={15} />} title="Fəallıq" />
              <ul className="adm-kv">
                <li><span><TrendingUp size={13} /> Bu həftə cavab</span><strong>{num(stats.answersThisWeek)}</strong></li>
                <li><span><ListChecks size={13} /> Ümumi cavab</span><strong>{num(stats.totalAnswers)}</strong></li>
                <li><span><Award size={13} /> Düzgün cavab nisbəti</span><strong>{correctRate}%</strong></li>
                <li><span><ClipboardList size={13} /> İmtahan cəhdi</span><strong>{num(stats.submittedAttempts)} / {num(stats.totalExamAttempts)}</strong></li>
              </ul>
              <ProgressBar value={correctRate} label={`Düzgün cavab nisbəti ${correctRate}%`} size="sm"
                tone={correctRate >= 70 ? 'success' : correctRate >= 50 ? 'warning' : 'brand'} />
            </Card>
          </div>

          <AuditCard />
        </>
      )}
    </div>
  );
}

// Rol adları — yalnız göstərmə üçün; səlahiyyət serverdədir.
const ROLE_LABELS: Record<string, string> = {
  Admin: 'Admin', Moderator: 'Moderator', VIP: 'VIP', Teacher: 'Müəllim', User: 'İstifadəçi',
};

// ── Courses Tab ───────────────────────────────────────────────
type CourseStatusFilter = 'all' | 'Pending' | 'Approved' | 'Rejected' | 'Expired';

// Yalnız http(s) linkləri klikləmək üçün göstərilir.
// Səbəb: <a href="javascript:..."> admin panelində kliklənəndə kod CARİ ORİGİN-də,
// yəni admin sessiyasında icra olunur — target="_blank" və rel="noreferrer" bunu dayandırmır.
// Server tərəfdə də https tələbi var; bu, ikinci qatdır (köhnə qeydlər üçün).
function isSafeExternalLink(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const STATUS_FILTERS: { value: CourseStatusFilter; label: string }[] = [
  { value: 'all', label: 'Hamısı' },
  { value: 'Pending', label: 'Gözləyən' },
  { value: 'Approved', label: 'Təsdiqli' },
  { value: 'Rejected', label: 'Rədd edilmiş' },
  { value: 'Expired', label: 'Passiv' },
];

const COURSE_STATUS: Record<AdminCourse['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  Approved: { label: 'Aktiv', tone: 'success' },
  Pending: { label: 'Gözlənilir', tone: 'warning' },
  Rejected: { label: 'Rədd', tone: 'danger' },
  // 30 günlük aktiv müddət bitib — sayt siyahısından avtomatik çıxarılıb.
  Expired: { label: 'Passiv', tone: 'neutral' },
};

// Tarix formatlaması bütün admin bölmələri üçün bir yerdə.
const formatDay = (iso?: string | null) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  : null;
const formatDateTime = (iso?: string | null) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : '—';
const daysLeft = (iso: string | null | undefined) => iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null;

export function CoursesTab({ onToast }: { onToast: ToastFn }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', instructor: '', category: '', link: '' });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCourse | null>(null);
  const [openRevision, setOpenRevision] = useState<number | null>(null);
  // Adminin birbaşa məzmun düzəlişi — sahibin redaktəsindən fərqli olaraq təsdiq gözləmir.
  const [editing, setEditing] = useState<AdminCourse | null>(null);

  // Uğursuz cavab sükutla udulmur: 403/500 halında "Nəticə tapılmadı" deyil, əsl səbəb görünür.
  const loader = useCallback(async () => {
    const res = await getAdminCourses();
    if (!res.success || !res.data) throw new Error(res.message || 'Məlumat yüklənə bilmədi.');
    return res.data;
  }, []);
  const { state, reload } = useAsyncData(loader);
  const courses = state.status === 'ready' ? state.data : [];

  // Status sayğacları həmişə TAM siyahıdan hesablanır — axtarış mətni onları dəyişməməlidir,
  // əks halda "Gözləyən (0)" görünüb admin moderasiya növbəsinin boş olduğunu zənn edə bilər.
  // "Gözləyən" filtrinə həm yeni/yenidən aktivləşdirmə sorğuları, həm də aktiv təlimə gözləyən redaktələr düşür.
  const isWaiting = (c: AdminCourse) => c.status === 'Pending' || Boolean(c.pendingRevision);
  const counts = {
    all: courses.length,
    Pending: courses.filter(isWaiting).length,
    Approved: courses.filter(c => c.status === 'Approved').length,
    Rejected: courses.filter(c => c.status === 'Rejected').length,
    Expired: courses.filter(c => c.status === 'Expired').length,
  };

  const filtered = courses.filter(c => {
    if (statusFilter === 'Pending' ? !isWaiting(c) : (statusFilter !== 'all' && c.status !== statusFilter)) return false;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.instructor.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const runAction = async (id: number, action: () => Promise<{ success: boolean; message: string; errors?: string[] }>) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      const res = await action();
      if (res.success) { onToast(res.message, 'success'); reload(); }
      else onToast(res.errors?.[0] || res.message || 'Xəta baş verdi.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = (id: number) => runAction(id, () => approveCourse(id));
  const handleReject = (id: number) => runAction(id, () => rejectCourse(id));
  const handleApproveRevision = (id: number) => runAction(id, () => approveCourseRevision(id));
  const handleRejectRevision = (id: number) => runAction(id, () => rejectCourseRevision(id));
  const handleDelete = async () => {
    if (!pendingDelete) return;
    await runAction(pendingDelete.id, () => deleteCourse(pendingDelete.id));
    setPendingDelete(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.instructor.trim() || !form.category.trim()) {
      onToast('Bütün sahələri doldurun.', 'error');
      return;
    }
    setSubmitting(true);
    const res = await createAdminCourse(form);
    if (res.success) {
      onToast(res.message, 'success');
      setForm({ title: '', instructor: '', category: '', link: '' });
      setShowForm(false);
      reload();
    } else {
      onToast(res.errors?.[0] || 'Xəta baş verdi.', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="adm">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">İdarəetmə paneli</span>
          <h1 className="page-header__title">Təlimlərin idarə edilməsi</h1>
          <p className="page-header__lead">VIP istifadəçilərin təlim təkliflərinə və dəyişikliklərinə baxın, təsdiqləyin, rədd edin və ya silin. Təsdiqlənən təlim 30 gün aktiv qalır, sonra avtomatik passivə düşür.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(p => !p)} aria-expanded={showForm}><Plus size={15} /> Yeni təlim əlavə et</Button>
      </div>

      {/* Yeni təlim forması */}
      {showForm && (
        <Card className="adm-form">
          <h3 className="card__title"><Plus size={15} /> Yeni təlim</h3>
          <form onSubmit={handleCreate} className="adm-form__body">
            <div className="form-grid form-grid--2">
              <FormField id="adm-course-title" label="Təlim adı" required>
                <input id="adm-course-title" className="input" type="text" placeholder="Məs: Network Security Pro" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </FormField>
              <FormField id="adm-course-instructor" label="Təlimçi" required>
                <input id="adm-course-instructor" className="input" type="text" placeholder="Məs: Əli Həsənov" value={form.instructor} onChange={e => setForm(p => ({ ...p, instructor: e.target.value }))} />
              </FormField>
              <FormField id="adm-course-category" label="Kateqoriya" required>
                <select id="adm-course-category" className="select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Seçin...</option>
                  <option>Ümumi</option>
                  <option>Network Security</option>
                  <option>Web Security</option>
                  <option>Active Directory</option>
                  <option>SOC</option>
                  <option>Code Review</option>
                </select>
              </FormField>
              <FormField id="adm-course-link" label="Keçid linki">
                <input id="adm-course-link" className="input" type="url" placeholder="https://..." value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} />
              </FormField>
            </div>
            <div className="adm-form__actions">
              <Button type="submit" variant="primary" loading={submitting}><Plus size={14} /> Əlavə et</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Ləğv et</Button>
            </div>
          </form>
        </Card>
      )}

      <Card padded={false} className="adm-table-card">
        <div className="adm-toolbar">
          <Tabs
            idPrefix="adm-course-filter"
            ariaLabel="Status filtri"
            items={STATUS_FILTERS.map(f => ({ id: f.value, label: f.label, count: counts[f.value] }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <div className="adm-toolbar__right">
            <SearchField value={search} onChange={setSearch} label="Təlim axtar" placeholder="Təlim, təlimçi və ya kateqoriya axtar..." size="sm" className="adm-search" />
            <Button variant="ghost" size="sm" onClick={reload} aria-label="Siyahını yenilə"><RefreshCw size={14} /></Button>
          </div>
        </div>

        {state.status === 'loading' && <div className="card--pad"><SkeletonList rows={4} /></div>}
        {state.status === 'error' && <ErrorState title="Təlimlər yüklənmədi" text={state.message} onRetry={reload} />}
        {state.status === 'ready' && filtered.length === 0 && (
          <EmptyState icon={<BookOpen size={20} />} title="Nəticə tapılmadı" text={search || statusFilter !== 'all' ? 'Filtri və ya axtarışı dəyişin.' : 'Hələ təlim təklifi yoxdur.'} />
        )}
        {state.status === 'ready' && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="table adm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Təlim</th>
                  <th>Təlimçi</th>
                  <th>Kateqoriya</th>
                  <th>Status</th>
                  <th>Müddət</th>
                  <th>Tarix</th>
                  <th className="cell-actions">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(course => {
                  const st = COURSE_STATUS[course.status] ?? { label: course.status, tone: 'warning' as const };
                  const busy = busyId === course.id;
                  const left = course.status === 'Approved' ? daysLeft(course.expiresAt) : null;
                  const revision = course.pendingRevision ?? null;
                  const revisionOpen = openRevision === course.id;
                  return (
                    <Fragment key={course.id}>
                    <tr>
                      <td className="cell-mono">{course.id}</td>
                      <td>
                        <div className="adm-user__text">
                          <span className="cell-main">{course.title}</span>
                          {course.ownerNickname && <span className="cell-sub"><Crown size={11} /> @{course.ownerNickname}</span>}
                        </div>
                      </td>
                      <td>{course.instructor}</td>
                      <td><Badge>{course.category}</Badge></td>
                      <td>
                        <div className="adm-badges">
                          <Badge tone={st.tone} dot>{st.label}</Badge>
                          {course.isReactivation && <Badge tone="info"><RotateCcw size={11} /> Yenidən aktivləşdirmə</Badge>}
                          {revision && <Badge tone="warning"><Clock size={11} /> Dəyişiklik gözləyir</Badge>}
                        </div>
                      </td>
                      <td className="cell-mono">
                        {course.status === 'Approved' && course.expiresAt && left !== null
                          ? <span title={`${formatDay(course.publishedAt)} — ${formatDay(course.expiresAt)}`}>{left} gün</span>
                          : course.status === 'Approved' ? <span className="cell-muted">müddətsiz</span>
                          : course.status === 'Expired' ? <span className="cell-muted">bitib {formatDay(course.expiresAt) ?? ''}</span>
                          : <span className="cell-muted">—</span>}
                      </td>
                      <td className="cell-mono">{course.createdAt}</td>
                      <td>
                        <div className="cell-actions">
                          {/* Moderasiya geri qaytarıla bilir: səhvən rədd edilən təlim
                              yenidən təsdiqlənə, səhvən təsdiqlənən isə geri götürülə bilər.
                              Təsdiq anından 30 günlük aktiv müddət açılır. */}
                          {course.status !== 'Approved' && (
                            <Button variant="success" size="sm" onClick={() => handleApprove(course.id)} disabled={busyId !== null} loading={busy}><CheckCircle size={13} /> Təsdiqlə</Button>
                          )}
                          {course.status !== 'Rejected' && (
                            <Button variant="outline" size="sm" onClick={() => handleReject(course.id)} disabled={busyId !== null}><XCircle size={13} /> Rədd et</Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditing(course)} disabled={busyId !== null}><Edit3 size={13} /> Redaktə</Button>
                          {revision && (
                            <Button variant="ghost" size="sm" onClick={() => setOpenRevision(revisionOpen ? null : course.id)} aria-expanded={revisionOpen}>
                              {revisionOpen ? <EyeOff size={13} /> : <Eye size={13} />} Dəyişiklik
                            </Button>
                          )}
                          {isSafeExternalLink(course.link) && (
                            <a href={course.link} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm"><ExternalLink size={13} /> Bax</a>
                          )}
                          <Button variant="danger" size="sm" onClick={() => setPendingDelete(course)} disabled={busyId !== null} aria-label={`${course.title} təlimini sil`}><Trash2 size={13} /> Sil</Button>
                        </div>
                      </td>
                    </tr>
                    {revision && revisionOpen && (
                      <tr className="adm-revision-row">
                        <td colSpan={8}>
                          <div className="adm-revision" role="region" aria-label={`${course.title} üçün gözləyən dəyişiklik`}>
                            <div className="adm-revision__head">
                              <strong><Clock size={13} /> Gözləyən dəyişiklik · {formatDay(revision.submittedAt)}</strong>
                              <span className="text-3 text-xs">Saytda hələ əvvəlki versiya görünür. Təsdiq aktiv müddəti uzatmır.</span>
                            </div>
                            <dl className="adm-revision__grid">
                              <div><dt>Başlıq</dt><dd>{revision.courseTitle}</dd></div>
                              <div><dt>Müəllim</dt><dd>{revision.instructorName} · {revision.instructorRole}{revision.instructorCompany ? ` · ${revision.instructorCompany}` : ''}</dd></div>
                              <div><dt>Müddət / Səviyyə / Dil</dt><dd>{revision.duration} · {revision.level} · {revision.language}</dd></div>
                              {revision.kicker && <div><dt>Üst başlıq</dt><dd>{revision.kicker}</dd></div>}
                              <div className="adm-revision__wide"><dt>Açıqlama</dt><dd>{revision.description}</dd></div>
                              {revision.syllabusTopics.length > 0 && <div className="adm-revision__wide"><dt>Mövzular ({revision.syllabusTopics.length})</dt><dd>{revision.syllabusTopics.join(' · ')}</dd></div>}
                              {(revision.contactEmail || revision.contactPhone) && <div><dt>Əlaqə</dt><dd>{[revision.contactEmail, revision.contactPhone].filter(Boolean).join(' · ')}</dd></div>}
                              {(revision.linkedInUrl || revision.gitHubUrl) && <div><dt>Linklər</dt><dd>{[revision.linkedInUrl, revision.gitHubUrl].filter(Boolean).join(' · ')}</dd></div>}
                            </dl>
                            <div className="cell-actions">
                              <Button variant="success" size="sm" onClick={() => handleApproveRevision(course.id)} disabled={busyId !== null} loading={busy}><CheckCircle size={13} /> Dəyişikliyi təsdiqlə</Button>
                              <Button variant="outline" size="sm" onClick={() => handleRejectRevision(course.id)} disabled={busyId !== null}><XCircle size={13} /> Dəyişikliyi rədd et</Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Təlimi redaktə et" kicker={editing.title} size="lg">
          <CourseForm
            initial={editing.content ? {
              instructorName: editing.content.instructorName, instructorRole: editing.content.instructorRole,
              instructorCompany: editing.content.instructorCompany ?? '', linkedInUrl: editing.content.linkedInUrl ?? '',
              gitHubUrl: editing.content.gitHubUrl ?? '', contactEmail: editing.content.contactEmail ?? '',
              contactPhone: editing.content.contactPhone ?? '', courseTitle: editing.content.courseTitle,
              kicker: editing.content.kicker ?? '', description: editing.content.description,
              duration: editing.content.duration, level: editing.content.level, language: editing.content.language,
              syllabusTopics: editing.content.syllabusTopics,
              instructorPhotoUrl: editing.content.instructorPhotoUrl ?? undefined,
              syllabusFileUrl: editing.content.syllabusFileUrl ?? undefined,
            } : undefined}
            submitLabel="Yadda saxla"
            submitIcon={<Save size={14} />}
            notice={
              <div className="notice notice--info" role="status">
                <ShieldCheck size={16} />
                <span>Admin düzəlişi dərhal saytda görünür (təsdiq gözləmir). Status və 30 günlük aktiv müddət dəyişmir; sahibin gözləyən redaktəsi varsa atılır.</span>
              </div>
            }
            onCancel={() => setEditing(null)}
            onSubmit={async (request: CreateCourseRequest) => {
              const res = await updateAdminCourse(editing.id, request as unknown as Record<string, unknown>);
              if (res.success) { onToast(res.message || 'Təlim yeniləndi.', 'success'); setEditing(null); reload(); }
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
        onConfirm={() => void handleDelete()}
      >
        {pendingDelete && <><strong>«{pendingDelete.title}»</strong> ({pendingDelete.instructor}) təlimi silinəcək. Bu əməliyyat panel üzərindən geri qaytarıla bilməz.</>}
      </ConfirmDialog>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────
const MANAGEABLE_ROLES = ['Moderator', 'Teacher', 'VIP', 'User'];

// Sistem administratoru bu siyahıya serverdən heç vaxt gəlmir.
// Burada yalnız idarə edilə bilən adi istifadəçi rolları göstərilir.
function primaryRole(roles: string[]): string {
  return MANAGEABLE_ROLES.find(r => roles.includes(r)) ?? 'User';
}

// ── İstifadəçi kartı ─────────────────────────────────────────
// Bütün məlumat + düzəliş + silmə bir pəncərədə. Silmə "təhlükəli zona"dadır və
// ləqəbin ƏLLƏ yazılmasını tələb edir: geri qaytarılmayan əməliyyat üçün tək klik azdır.
function UserDetailModal({ userId, onClose, onToast, onChanged }: {
  userId: string; onClose: () => void; onToast: ToastFn; onChanged: () => void;
}) {
  const loader = useCallback(async () => {
    const res = await getUserDetail(userId);
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'İstifadəçi yüklənmədi.');
    return res.data;
  }, [userId]);
  const { state, reload } = useAsyncData(loader);
  const user = state.status === 'ready' ? state.data : null;

  const [form, setForm] = useState({ firstName: '', lastName: '', nickname: '', gender: 1, confirmEmail: false });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  // Forma yalnız BİR dəfə — məlumat gələndə — doldurulur; sonrakı render-lər yazılanı silmir.
  if (user && !ready) {
    setReady(true);
    setForm({
      firstName: user.firstName, lastName: user.lastName, nickname: user.nickname,
      gender: user.gender === 2 ? 2 : 1, confirmEmail: false,
    });
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !user) return;
    setSaving(true); setErrors([]);
    try {
      const res = await updateUser(user.id, form);
      if (res.success) { onToast(res.message || 'Məlumatlar yeniləndi.', 'success'); reload(); onChanged(); }
      else setErrors(res.errors?.length ? res.errors : [res.message || 'Xəta baş verdi.']);
    } catch { setErrors(['Serverlə əlaqə yaradıla bilmədi.']); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (deleting || !user) return;
    setDeleting(true);
    try {
      const res = await deleteUser(user.id);
      if (res.success) { onToast(res.message || 'Hesab silindi.', 'success'); onChanged(); onClose(); }
      else onToast(res.errors?.[0] || res.message || 'Hesab silinmədi.', 'error');
    } catch { onToast('Serverlə əlaqə yaradıla bilmədi.', 'error'); }
    finally { setDeleting(false); }
  };

  return (
    <Modal open onClose={onClose} title={user ? `${user.firstName} ${user.lastName}` : 'İstifadəçi'}
      kicker={user ? `@${user.nickname}` : 'Yüklənir...'} size="lg">
      {state.status === 'loading' && <SkeletonList rows={4} />}
      {state.status === 'error' && <ErrorState title="İstifadəçi yüklənmədi" text={state.message} onRetry={reload} />}
      {user && (
        <div className="adm-detail">
          <div className="adm-detail__badges">
            {user.roles.map(role => <Badge key={role} tone={role === 'VIP' ? 'warning' : role === 'Teacher' ? 'success' : 'neutral'}>{ROLE_LABELS[role] ?? role}</Badge>)}
            {user.isBlocked
              ? <Badge tone="danger"><Lock size={11} /> Bloklanıb</Badge>
              : user.isTemporarilyLocked
                ? <Badge tone="warning"><Lock size={11} /> Müvəqqəti kilid</Badge>
                : <Badge tone="success" dot>Aktiv</Badge>}
            {user.isEmailConfirmed
              ? <Badge tone="success"><CheckCircle size={11} /> E-poçt təsdiqli</Badge>
              : <Badge tone="warning"><Clock size={11} /> E-poçt təsdiqlənməyib</Badge>}
          </div>

          <ul className="adm-kv adm-detail__kv">
            <li><span><Mail size={13} /> E-poçt</span><strong>{user.email}</strong></li>
            {user.pendingNewEmail && <li><span><Mail size={13} /> Gözləyən e-poçt</span><strong>{user.pendingNewEmail}</strong></li>}
            <li><span><Calendar size={13} /> Qeydiyyat</span><strong>{formatDay(user.createdAt) ?? "—"}</strong></li>
            <li><span><Activity size={13} /> Son fəallıq</span><strong>{formatDateTime(user.lastActivityAt)}</strong></li>
            <li><span><ShieldAlert size={13} /> Uğursuz giriş cəhdi</span><strong>{user.failedAttempts}</strong></li>
            <li><span><Users size={13} /> Hesab ID</span><strong className="cell-mono adm-detail__id">{user.id}</strong></li>
          </ul>

          <div className="stat-grid adm-detail__stats">
            <StatCard icon={<ListChecks size={18} />} tone="info" value={`${user.correctAnswers} / ${user.answeredQuestions}`} label="Düzgün / cavab" />
            <StatCard icon={<BookOpen size={18} />} tone="brand" value={`${user.activeCourseCount} / ${user.courseCount}`} label="Aktiv / ümumi təlim" />
            <StatCard icon={<ClipboardList size={18} />} tone="success" value={user.examSessionCount} label="Yaratdığı sessiya" />
            <StatCard icon={<CheckCircle size={18} />} tone="warning" value={user.examAttemptCount} label="İmtahan cəhdi" />
          </div>

          <Card tone={user.hasActiveVipTerm ? 'brand' : undefined} padded="sm">
            <CardHead icon={<Crown size={15} />} title="VIP üzvlük"
              action={<Badge tone={user.hasActiveVipTerm ? 'success' : 'neutral'} dot>{user.hasActiveVipTerm ? 'Aktiv dövr' : 'Aktiv dövr yoxdur'}</Badge>} />
            {user.hasActiveVipTerm ? (
              <p className="note">
                {formatDay(user.vipTermStartsAt) ?? "—"} — {formatDay(user.vipTermEndsAt) ?? "—"} ·
                bu dövrdə <strong>{user.vipCoursesUsed} / {user.vipCourseAllowance}</strong> təlim paylaşılıb
                (ümumi {user.vipTermCount} dövr).
              </p>
            ) : (
              <p className="note">Aktiv dövr yoxdur. Ümumi {user.vipTermCount} dövr olub. Yeni dövr açmaq üçün cədvəldəki «VIP dövrü» düyməsindən istifadə edin.</p>
            )}
            {user.teacherClassCount > 0 && <p className="note">Müəllim sinifləri: <strong>{user.teacherClassCount}</strong> — rol dəyişməzdən əvvəl silinməlidir.</p>}
          </Card>

          <form className="adm-detail__form" onSubmit={save}>
            <div className="form-section">Məlumatların düzəlişi</div>
            <div className="form-grid form-grid--2">
              <FormField id="adm-u-first" label="Ad" required>
                <input id="adm-u-first" className="input" value={form.firstName} required maxLength={50}
                  onChange={e => setForm(c => ({ ...c, firstName: e.target.value }))} />
              </FormField>
              <FormField id="adm-u-last" label="Soyad" required>
                <input id="adm-u-last" className="input" value={form.lastName} required maxLength={50}
                  onChange={e => setForm(c => ({ ...c, lastName: e.target.value }))} />
              </FormField>
              <FormField id="adm-u-nick" label="Ləqəb (giriş adı)" required hint="3–16 simvol: hərf, rəqəm, alt xətt">
                <input id="adm-u-nick" className="input" value={form.nickname} required minLength={3} maxLength={16}
                  onChange={e => setForm(c => ({ ...c, nickname: e.target.value }))} />
              </FormField>
              <FormField id="adm-u-gender" label="Cins">
                <select id="adm-u-gender" className="select" value={form.gender}
                  onChange={e => setForm(c => ({ ...c, gender: Number(e.target.value) }))}>
                  <option value={1}>Kişi</option>
                  <option value={2}>Qadın</option>
                </select>
              </FormField>
            </div>

            {!user.isEmailConfirmed && (
              <label className="adm-switch">
                <input type="checkbox" checked={form.confirmEmail}
                  onChange={e => setForm(c => ({ ...c, confirmEmail: e.target.checked }))} />
                <span>E-poçtu təsdiqlənmiş say (istifadəçi məktubu ala bilmirsə)</span>
              </label>
            )}

            {errors.length > 0 && (
              <div className="notice notice--danger" role="alert"><ul>{errors.map((msg, i) => <li key={i}>{msg}</li>)}</ul></div>
            )}

            <div className="modal__actions">
              <Button variant="outline" onClick={onClose}>Bağla</Button>
              <Button type="submit" variant="primary" loading={saving}><Save size={14} /> Yadda saxla</Button>
            </div>
          </form>

          <div className="adm-danger">
            <button type="button" className="adm-danger__toggle" onClick={() => setShowDanger(v => !v)} aria-expanded={showDanger}>
              <UserX size={14} /> Təhlükəli zona {showDanger ? '▲' : '▼'}
            </button>
            {showDanger && (
              <div className="adm-danger__body">
                <div className="notice notice--danger" role="alert">
                  <AlertTriangle size={16} />
                  <span>
                    Hesab <strong>həmişəlik</strong> silinir: quiz cavabları, imtahan cəhdləri, VIP dövrləri və öz sinifləri
                    də gedir; təlimləri saytdan yığışdırılır, yaratdığı imtahan sessiyaları isə (başqalarının nəticəsi olduğu
                    üçün) arxivə keçir. Bu əməliyyat geri qaytarılmır.
                  </span>
                </div>
                <FormField id="adm-u-confirm" label={`Təsdiq üçün "${user.nickname}" yazın`}>
                  <input id="adm-u-confirm" className="input" value={confirmText} autoComplete="off"
                    onChange={e => setConfirmText(e.target.value)} placeholder={user.nickname} />
                </FormField>
                <Button variant="danger" loading={deleting} disabled={confirmText.trim() !== user.nickname}
                  onClick={() => void remove()}>
                  <Trash2 size={14} /> Hesabı həmişəlik sil
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function UsersTab({ onToast }: { onToast: ToastFn }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingBlock, setPendingBlock] = useState<AdminUser | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Yazarkən hər hərfdə sorğu getməsin deyə 350 ms gecikmə.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Axtarış SERVER tərəfdə aparılır: siyahı məhdudlaşdırıldığı üçün müştəri tərəfdə
  // filtrləmək yüklənməmiş istifadəçiləri gizlədərdi.
  const loader = useCallback(async () => {
    const res = await getAdminUsers(query);
    if (!res.success || !res.data) throw new Error(res.message || 'Məlumat yüklənə bilmədi.');
    // Hədd dolduqda server bunu mesajda bildirir — admin siyahını tam sanmasın.
    return { users: res.data, notice: res.data.length > 0 ? (res.message ?? '') : '' };
  }, [query]);
  const { state, reload } = useAsyncData(loader);
  const users = state.status === 'ready' ? state.data.users : [];
  const notice = state.status === 'ready' ? state.data.notice : '';

  const handleRoleChange = async (userId: string, role: string) => {
    if (busyId !== null) return;
    setBusyId(userId);
    try {
      const res = await changeUserRole(userId, role);
      if (res.success) { onToast(res.message, 'success'); reload(); }
      else onToast(res.errors?.[0] || 'Xəta', 'error');
    } finally { setBusyId(null); }
  };

  // "VIP ödənişi"nin admin ekvivalenti: 30 günlük dövr + 1 təlim krediti (rol yoxdursa verilir).
  const handleVipTerm = async (user: AdminUser) => {
    if (busyId !== null) return;
    setBusyId(user.id);
    try {
      const res = await startVipTerm(user.id);
      if (res.success) { onToast(res.message, 'success'); reload(); }
      else onToast(res.errors?.[0] || res.message || 'Xəta', 'error');
    } finally { setBusyId(null); }
  };

  const handleBlock = async (user: AdminUser) => {
    if (busyId !== null) return;
    setBusyId(user.id);
    try {
      const res = await toggleUserBlock(user.id);
      if (res.success) { onToast(res.message, 'success'); reload(); }
      else onToast(res.errors?.[0] || 'Xəta', 'error');
    } finally { setBusyId(null); setPendingBlock(null); }
  };

  return (
    <div className="adm">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">İdarəetmə paneli</span>
          <h1 className="page-header__title">İstifadəçilərin idarə edilməsi</h1>
          <p className="page-header__lead">Platformadakı istifadəçilərə baxın, rollarını dəyişin və hesabları bloklayın.</p>
        </div>
      </div>

      <Card padded={false} className="adm-table-card">
        <div className="adm-toolbar">
          <h3 className="card__title adm-toolbar__title"><Users size={15} /> İstifadəçilər {state.status === 'ready' && <span className="tab__count">({users.length})</span>}</h3>
          <div className="adm-toolbar__right">
            <SearchField value={search} onChange={setSearch} label="İstifadəçi axtar" placeholder="Ad, e-poçt və ya ləqəb üzrə axtar..." size="sm" className="adm-search" />
            <Button variant="ghost" size="sm" onClick={reload} aria-label="Siyahını yenilə"><RefreshCw size={14} /></Button>
          </div>
        </div>
        {notice && state.status === 'ready' && <div className="adm-notice"><AlertTriangle size={14} /> {notice}</div>}

        {state.status === 'loading' && <div className="card--pad"><SkeletonList rows={5} /></div>}
        {state.status === 'error' && <ErrorState title="İstifadəçilər yüklənmədi" text={state.message} onRetry={reload} />}
        {state.status === 'ready' && users.length === 0 && (
          <EmptyState icon={<Users size={20} />} title="Nəticə tapılmadı" text={query ? 'Axtarış sorğusunu dəyişin.' : 'Hələ istifadəçi yoxdur.'} />
        )}
        {state.status === 'ready' && users.length > 0 && (
          <div className="table-wrap">
            <table className="table adm-table">
              <thead>
                <tr>
                  <th>İstifadəçi</th>
                  <th>E-poçt</th>
                  <th>Rol</th>
                  <th>E-poçt təsdiqi</th>
                  <th>Status</th>
                  <th>Qeydiyyat</th>
                  <th className="cell-actions">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const busy = busyId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="adm-user">
                          <span className="avatar avatar--sm" aria-hidden="true">{(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')}</span>
                          <div className="adm-user__text">
                            <span className="cell-main">{user.firstName} {user.lastName}</span>
                            <span className="cell-sub">@{user.nickname}</span>
                          </div>
                        </div>
                      </td>
                      <td className="cell-muted adm-email">{user.email}</td>
                      <td>
                        <label className="visually-hidden" htmlFor={`adm-role-${user.id}`}>{user.nickname} üçün rol</label>
                        <select
                          id={`adm-role-${user.id}`}
                          className="select input--sm adm-role"
                          value={primaryRole(user.roles)}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          disabled={busyId !== null}
                        >
                          {MANAGEABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {user.roles.includes('VIP') && (
                          <span className="cell-sub adm-vip-term">
                            <Crown size={11} />
                            {user.vipTermEndsAt
                              ? `${formatDay(user.vipTermEndsAt)} tarixinədək · ${user.vipCoursesRemaining ?? 0} təlim krediti`
                              : 'Aktiv VIP dövrü yoxdur'}
                          </span>
                        )}
                      </td>
                      <td>
                        {user.isEmailConfirmed
                          ? <Badge tone="success"><CheckCircle size={12} /> Təsdiqlənib</Badge>
                          : <Badge tone="warning"><Clock size={12} /> Gözləyir</Badge>}
                      </td>
                      <td>
                        {user.isBlocked
                          ? <Badge tone="danger"><Lock size={12} /> Bloklanıb</Badge>
                          : user.isTemporarilyLocked
                            ? <Badge tone="warning"><Lock size={12} /> Müvəqqəti kilid</Badge>
                            : <Badge tone="success" dot>Aktiv</Badge>}
                      </td>
                      <td className="cell-mono">{user.joinDate}</td>
                      <td>
                        <div className="cell-actions">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(user.id)}><Eye size={13} /> Bax</Button>
                          <Button variant="outline" size="sm" onClick={() => void handleVipTerm(user)} disabled={busyId !== null} loading={busy}
                            title="30 günlük VIP dövrü açır (1 təlim krediti); VIP rolu yoxdursa verilir">
                            <Crown size={13} /> VIP dövrü (30 gün)
                          </Button>
                          {user.isBlocked ? (
                            <Button variant="success" size="sm" onClick={() => void handleBlock(user)} disabled={busyId !== null} loading={busy}><Unlock size={13} /> Bloku aç</Button>
                          ) : (
                            <Button variant="danger" size="sm" onClick={() => setPendingBlock(user)} disabled={busyId !== null} loading={busy}><Lock size={13} /> Blokla</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailId && (
        <UserDetailModal userId={detailId} onClose={() => setDetailId(null)} onToast={onToast} onChanged={reload} />
      )}

      <ConfirmDialog
        open={pendingBlock !== null}
        title="İstifadəçini bloklamaq istəyirsiniz?"
        confirmLabel="Bəli, blokla"
        icon={<Lock size={14} />}
        busy={busyId !== null}
        onCancel={() => { if (busyId === null) setPendingBlock(null); }}
        onConfirm={() => { if (pendingBlock) void handleBlock(pendingBlock); }}
      >
        {pendingBlock && <><strong>@{pendingBlock.nickname}</strong> ({pendingBlock.firstName} {pendingBlock.lastName}) bloklanacaq və aktiv sessiyaları bağlanacaq. Bloku sonra buradan aça bilərsiniz.</>}
      </ConfirmDialog>
    </div>
  );
}

// İmtahan sessiyaları AdminExamsTab.tsx-dədir, kateqoriya + sual bankı isə AdminBankTab.tsx-də:
// bu fayl yalnız İcmal, Təlimlər və İstifadəçilər bölmələrini saxlayır.
