// ============================================================
// AdminPanel.tsx — Admin idarəetmə bölmələri
//
// Bu fayl ayrıca səhifə deyil: tab komponentləri export edilir və
// UserDashboard (Kabinetim) içində Admin rolu olan istifadəçiyə göstərilir.
//
// TƏHLÜKƏSİZLİK: bu komponentlərin görünməsi heç bir səlahiyyət vermir.
// Bütün api/admin endpoint-ləri serverdə [Authorize(Roles = "Admin")] ilə qorunur.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Users, ClipboardList, CheckCircle, XCircle, Trash2, Plus, RefreshCw, AlertTriangle,
  ExternalLink, Lock, Unlock, UserPlus, Clock, Layers, ShieldAlert,
} from 'lucide-react';
import {
  getAdminCourses, getAdminUsers, getAdminExams,
  approveCourse, rejectCourse, deleteCourse, createAdminCourse,
  changeUserRole, toggleUserBlock, deleteExam,
  type AdminStats, type AdminCourse, type AdminUser, type AdminExam,
} from '../services/adminService';
import { useAsyncData } from '../hooks/useAsyncData';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FormField, SearchField, SkeletonList, StatCard, Tabs } from './ui';
import './AdminPanel.css';

type ToastFn = (msg: string, type: 'success' | 'error') => void;

// ── Dashboard Tab ─────────────────────────────────────────────
export function DashboardTab({ stats, onRefresh }: { stats: AdminStats | null; onRefresh: () => void }) {
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
        <SkeletonList rows={3} />
      ) : (
        <div className="stat-grid adm-stats">
          <StatCard icon={<Users size={18} />} tone="info" value={stats.totalUsers.toLocaleString('az-AZ')} label="Ümumi istifadəçi" />
          <StatCard icon={<UserPlus size={18} />} tone="success" value={stats.newUsersThisWeek.toLocaleString('az-AZ')} label="Bu həftə qeydiyyat" />
          <StatCard icon={<BookOpen size={18} />} tone="brand" value={stats.totalCourses.toLocaleString('az-AZ')} label="Ümumi təlim" />
          <StatCard icon={<Clock size={18} />} tone="warning" value={stats.pendingCourses.toLocaleString('az-AZ')} label="Gözləyən təlim" />
          <StatCard icon={<ClipboardList size={18} />} tone="info" value={stats.activeExams.toLocaleString('az-AZ')} label="Aktiv imtahan" />
          <StatCard icon={<Layers size={18} />} tone="neutral" value={stats.totalExams.toLocaleString('az-AZ')} label="Ümumi imtahan" />
        </div>
      )}
    </div>
  );
}

// ── Courses Tab ───────────────────────────────────────────────
type CourseStatusFilter = 'all' | 'Pending' | 'Approved' | 'Rejected';

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
];

const COURSE_STATUS: Record<AdminCourse['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  Approved: { label: 'Aktiv', tone: 'success' },
  Pending: { label: 'Gözlənilir', tone: 'warning' },
  Rejected: { label: 'Rədd', tone: 'danger' },
};

export function CoursesTab({ onToast }: { onToast: ToastFn }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', instructor: '', category: '', link: '' });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCourse | null>(null);

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
  const counts = {
    all: courses.length,
    Pending: courses.filter(c => c.status === 'Pending').length,
    Approved: courses.filter(c => c.status === 'Approved').length,
    Rejected: courses.filter(c => c.status === 'Rejected').length,
  };

  const filtered = courses.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
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
          <p className="page-header__lead">Təlim təkliflərinə baxın, təsdiqləyin, rədd edin və ya silin.</p>
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
                  <th>Tarix</th>
                  <th className="cell-actions">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(course => {
                  const st = COURSE_STATUS[course.status] ?? { label: course.status, tone: 'warning' as const };
                  const busy = busyId === course.id;
                  return (
                    <tr key={course.id}>
                      <td className="cell-mono">{course.id}</td>
                      <td className="cell-main">{course.title}</td>
                      <td>{course.instructor}</td>
                      <td><Badge>{course.category}</Badge></td>
                      <td><Badge tone={st.tone} dot>{st.label}</Badge></td>
                      <td className="cell-mono">{course.createdAt}</td>
                      <td>
                        <div className="cell-actions">
                          {/* Moderasiya geri qaytarıla bilir: səhvən rədd edilən təlim
                              yenidən təsdiqlənə, səhvən təsdiqlənən isə geri götürülə bilər. */}
                          {course.status !== 'Approved' && (
                            <Button variant="success" size="sm" onClick={() => handleApprove(course.id)} disabled={busyId !== null} loading={busy}><CheckCircle size={13} /> Təsdiqlə</Button>
                          )}
                          {course.status !== 'Rejected' && (
                            <Button variant="outline" size="sm" onClick={() => handleReject(course.id)} disabled={busyId !== null}><XCircle size={13} /> Rədd et</Button>
                          )}
                          {isSafeExternalLink(course.link) && (
                            <a href={course.link} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm"><ExternalLink size={13} /> Bax</a>
                          )}
                          <Button variant="danger" size="sm" onClick={() => setPendingDelete(course)} disabled={busyId !== null} aria-label={`${course.title} təlimini sil`}><Trash2 size={13} /> Sil</Button>
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

export function UsersTab({ onToast }: { onToast: ToastFn }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingBlock, setPendingBlock] = useState<AdminUser | null>(null);

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
                      </td>
                      <td>
                        {user.isEmailConfirmed
                          ? <Badge tone="success"><CheckCircle size={12} /> Təsdiqlənib</Badge>
                          : <Badge tone="warning"><Clock size={12} /> Gözləyir</Badge>}
                      </td>
                      <td>
                        {user.isBlocked
                          ? <Badge tone="danger"><Lock size={12} /> Bloklanıb</Badge>
                          : <Badge tone="success" dot>Aktiv</Badge>}
                      </td>
                      <td className="cell-mono">{user.joinDate}</td>
                      <td>
                        <div className="cell-actions">
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

// ── Exams Tab ─────────────────────────────────────────────────
// Backend-də hər sətir bir quiz kateqoriyasıdır (studentCount = cavab verən unikal
// istifadəçi, duration = sual sayı). Etiketlər real API davranışına uyğundur.
const EXAM_STATUS: Record<string, 'success' | 'warning' | 'neutral'> = { 'Aktiv': 'success', 'Gözlənilir': 'warning', 'Tamamlandı': 'neutral' };

export function ExamsTab({ onToast }: { onToast: ToastFn }) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminExam | null>(null);

  const loader = useCallback(async () => {
    const res = await getAdminExams();
    if (!res.success || !res.data) throw new Error(res.message || 'Məlumat yüklənə bilmədi.');
    return res.data;
  }, []);
  const { state, reload } = useAsyncData(loader);
  const exams = state.status === 'ready' ? state.data : [];

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.instructor.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  // Bu əməliyyat KASKADLIDIR: kateqoriya ilə birlikdə içindəki bütün suallar da silinir.
  const handleDelete = async () => {
    if (!pendingDelete || busyId !== null) return;
    setBusyId(pendingDelete.id);
    try {
      const res = await deleteExam(pendingDelete.id);
      if (res.success) { onToast(res.message, 'success'); reload(); }
      else onToast(res.errors?.[0] || 'Xəta', 'error');
    } finally { setBusyId(null); setPendingDelete(null); }
  };

  return (
    <div className="adm">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">İdarəetmə paneli</span>
          <h1 className="page-header__title">İmtahan kateqoriyaları</h1>
          <p className="page-header__lead">Sual bankının kateqoriyaları və onlarda cavab vermiş istifadəçi sayı. Silmə kateqoriyanı bütün sualları ilə birlikdə gizlədir.</p>
        </div>
      </div>

      <Card padded={false} className="adm-table-card">
        <div className="adm-toolbar">
          <h3 className="card__title adm-toolbar__title"><ClipboardList size={15} /> Kateqoriyalar {state.status === 'ready' && <span className="tab__count">({filtered.length})</span>}</h3>
          <div className="adm-toolbar__right">
            <SearchField value={search} onChange={setSearch} label="Kateqoriya axtar" placeholder="Başlıq və ya kateqoriya axtar..." size="sm" className="adm-search" />
            <Button variant="ghost" size="sm" onClick={reload} aria-label="Siyahını yenilə"><RefreshCw size={14} /></Button>
          </div>
        </div>

        {state.status === 'loading' && <div className="card--pad"><SkeletonList rows={5} /></div>}
        {state.status === 'error' && <ErrorState title="Siyahı yüklənmədi" text={state.message} onRetry={reload} />}
        {state.status === 'ready' && filtered.length === 0 && (
          <EmptyState icon={<ClipboardList size={20} />} title="Nəticə tapılmadı" text={search ? 'Axtarış sorğusunu dəyişin.' : 'Hələ kateqoriya yoxdur.'} />
        )}
        {state.status === 'ready' && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="table adm-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Başlıq</th>
                  <th>Təlimçi</th>
                  <th>Kateqoriya</th>
                  <th className="is-num">İştirakçı</th>
                  <th>Sual sayı</th>
                  <th>Status</th>
                  <th>Tarix</th>
                  <th className="cell-actions">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exam => (
                  <tr key={exam.id}>
                    <td className="cell-mono">{exam.id}</td>
                    <td className="cell-main">{exam.title}</td>
                    <td>{exam.instructor}</td>
                    <td><Badge>{exam.category}</Badge></td>
                    <td className="is-num"><strong>{exam.studentCount}</strong></td>
                    <td className="cell-muted">{exam.duration}</td>
                    <td><Badge tone={EXAM_STATUS[exam.status] ?? 'neutral'} dot>{exam.status}</Badge></td>
                    <td className="cell-mono">{exam.createdAt}</td>
                    <td>
                      <div className="cell-actions">
                        <Button variant="danger" size="sm" onClick={() => setPendingDelete(exam)} disabled={busyId !== null} loading={busyId === exam.id} aria-label={`${exam.title} kateqoriyasını sil`}><Trash2 size={13} /> Sil</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Diqqət — bu əməliyyat kaskadlıdır"
        confirmLabel="Bəli, kateqoriyanı və sualları sil"
        icon={<ShieldAlert size={14} />}
        busy={busyId !== null}
        onCancel={() => { if (busyId === null) setPendingDelete(null); }}
        onConfirm={() => void handleDelete()}
      >
        {pendingDelete && (
          <>
            <strong>«{pendingDelete.title}»</strong> kateqoriyası ({pendingDelete.duration}) silinəcək.
            Bu kateqoriyaya aid <strong>bütün suallar</strong> da birlikdə silinəcək və panel üzərindən geri qaytarıla bilməz.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
