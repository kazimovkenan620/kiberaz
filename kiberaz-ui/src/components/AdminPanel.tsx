// ============================================================
// AdminPanel.tsx — Admin idarəetmə bölmələri
//
// Bu fayl artıq ayrıca səhifə deyil: tab komponentləri export edilir və
// UserDashboard (Kabinetim) içində Admin rolu olan istifadəçiyə göstərilir.
// Ayrıca "Admin" düyməsi və marşrutu silinib — bir giriş nöqtəsi qalıb.
//
// TƏHLÜKƏSİZLİK: bu komponentlərin görünməsi heç bir səlahiyyət vermir.
// Bütün api/admin endpoint-ləri serverdə [Authorize(Roles = "Admin")] ilə qorunur.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, Users, ClipboardList,
  ArrowLeft, CheckCircle, XCircle, Trash2, Shield,
  Plus, Search, RefreshCw, AlertTriangle, Eye,
} from 'lucide-react';
import {
  getAdminStats, getAdminCourses, getAdminUsers, getAdminExams,
  approveCourse, rejectCourse, deleteCourse, createAdminCourse,
  changeUserRole, toggleUserBlock, deleteExam,
  type AdminStats, type AdminCourse, type AdminUser, type AdminExam,
} from '../services/adminService';
import './AdminPanel.css';

// ── Tab tipi ─────────────────────────────────────────────────
type AdminTab = 'dashboard' | 'courses' | 'users' | 'exams';

// ── Toast ────────────────────────────────────────────────────
export function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`admin-toast ${type === 'error' ? 'error' : ''}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {message}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────
export function DashboardTab({ stats, onRefresh }: { stats: AdminStats | null; onRefresh: () => void }) {
  if (!stats) return <div className="admin-empty"><div className="admin-empty-icon">⏳</div>Yüklənir...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">İcmal</h2>
        <p className="admin-page-subtitle">Platformanın ümumi vəziyyəti</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-icon"><Users size={18} color="var(--brand-primary)" /></div>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">Ümumi İstifadəçi</div>
        </div>
        <div className="admin-stat-card success-accent">
          <div className="stat-icon success"><Users size={18} color="var(--brand-success)" /></div>
          <div className="stat-value">{stats.newUsersThisWeek}</div>
          <div className="stat-label">Bu Həftə Qeydiyyat</div>
        </div>
        <div className="admin-stat-card gold-accent">
          <div className="stat-icon gold"><BookOpen size={18} color="var(--brand-gold)" /></div>
          <div className="stat-value">{stats.totalCourses}</div>
          <div className="stat-label">Ümumi Təlim</div>
        </div>
        <div className="admin-stat-card danger-accent">
          <div className="stat-icon danger"><AlertTriangle size={18} color="#ef4444" /></div>
          <div className="stat-value">{stats.pendingCourses}</div>
          <div className="stat-label">Gözləyən Təlim</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon"><ClipboardList size={18} color="var(--brand-primary)" /></div>
          <div className="stat-value">{stats.activeExams}</div>
          <div className="stat-label">Aktiv İmtahan</div>
        </div>
        <div className="admin-stat-card gold-accent">
          <div className="stat-icon gold"><ClipboardList size={18} color="var(--brand-gold)" /></div>
          <div className="stat-value">{stats.totalExams}</div>
          <div className="stat-label">Ümumi İmtahan</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="admin-btn admin-btn-ghost" onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Yenilə
        </button>
      </div>
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
  { value: 'Pending', label: '⏳ Gözləyən' },
  { value: 'Approved', label: '✓ Təsdiqli' },
  { value: 'Rejected', label: '✕ Rədd edilmiş' },
];

export function CoursesTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', instructor: '', category: '', link: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAdminCourses();

    // Əvvəl uğursuz cavab sükutla udulurdu: 403/500 halında siyahı boş qalır və
    // ekranda "Nəticə tapılmadı" görünürdü — yəni səlahiyyət xətası "data yoxdur" kimi oxunurdu.
    if (res.success && res.data) {
      setCourses(res.data);
      setLoadError('');
    } else {
      setCourses([]);
      setLoadError(res.message || 'Məlumat yüklənə bilmədi.');
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const handleApprove = async (id: number) => {
    const res = await approveCourse(id);
    if (res.success) { onToast(res.message, 'success'); load(); }
  };

  const handleReject = async (id: number) => {
    const res = await rejectCourse(id);
    if (res.success) { onToast(res.message, 'success'); load(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu təlimi silmək istədiyinizə əminsiniz?')) return;
    const res = await deleteCourse(id);
    if (res.success) { onToast(res.message, 'success'); load(); }
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
      load();
    } else {
      onToast(res.errors?.[0] || 'Xəta baş verdi.', 'error');
    }
    setSubmitting(false);
  };

  const statusMap: Record<string, string> = {
    Approved: 'approved', Pending: 'pending', Rejected: 'rejected',
  };
  const statusLabel: Record<string, string> = {
    Approved: '✓ Aktiv', Pending: '⏳ Gözlənilir', Rejected: '✕ Rədd',
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">Təlim İdarəetməsi</h2>
        <p className="admin-page-subtitle">Təlimləri idarə edin, təsdiqləyin və ya silin</p>
      </div>

      {/* Yeni təlim forması */}
      {showForm && (
        <div className="admin-form-card">
          <div className="admin-form-title"><Plus size={16} /> Yeni Təlim Əlavə Et</div>
          <form onSubmit={handleCreate}>
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label>Təlim Adı *</label>
                <input
                  type="text"
                  placeholder="Məs: Network Security Pro"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="admin-form-field">
                <label>Təlimçi *</label>
                <input
                  type="text"
                  placeholder="Məs: Əli Həsənov"
                  value={form.instructor}
                  onChange={e => setForm(p => ({ ...p, instructor: e.target.value }))}
                />
              </div>
              <div className="admin-form-field">
                <label>Kateqoriya *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Seçin...</option>
                  <option>Ümumi</option>
                  <option>Network Security</option>
                  <option>Web Security</option>
                  <option>Active Directory</option>
                  <option>SOC</option>
                  <option>Code Review</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Keçid Linki</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.link}
                  onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-form-actions">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                <Plus size={14} /> {submitting ? 'Əlavə edilir...' : 'Əlavə Et'}
              </button>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setShowForm(false)}>
                Ləğv et
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-card">
        <div className="admin-table-header">
          <h3 className="admin-table-title"><BookOpen size={16} /> Təlimlər ({filtered.length})</h3>
          <div className="admin-table-actions">
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="admin-search-input"
                style={{ paddingLeft: 32 }}
                type="text"
                placeholder="Təlim axtar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setShowForm(p => !p)}>
              <Plus size={13} /> Yeni Təlim
            </button>
          </div>
        </div>

        {/* Status filtri — moderasiya növbəsini bir kliklə açır */}
        <div className="admin-filter-row" role="group" aria-label="Status filtri">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              className={`admin-btn admin-btn-sm ${statusFilter === f.value ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
            >
              {f.label} ({counts[f.value]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="admin-empty">⏳ Yüklənir...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">{loadError ? '⚠️' : '📭'}</div>
            {loadError || 'Nəticə tapılmadı'}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Təlim Adı</th>
                  <th>Təlimçi</th>
                  <th>Kateqoriya</th>
                  <th>Status</th>
                  <th>Tarix</th>
                  <th>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(course => (
                  <tr key={course.id}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{course.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{course.title}</td>
                    <td>{course.instructor}</td>
                    <td style={{ color: 'var(--brand-primary)', fontSize: '0.8rem' }}>{course.category}</td>
                    <td>
                      <span className={`admin-badge ${statusMap[course.status]}`}>
                        {statusLabel[course.status]}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{course.createdAt}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Moderasiya geri qaytarıla bilir: səhvən rədd edilən təlim
                            yenidən təsdiqlənə, səhvən təsdiqlənən isə geri götürülə bilər. */}
                        {course.status !== 'Approved' && (
                          <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => handleApprove(course.id)}>
                            <CheckCircle size={12} /> Təsdiqlə
                          </button>
                        )}
                        {course.status !== 'Rejected' && (
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleReject(course.id)}>
                            <XCircle size={12} /> Rədd et
                          </button>
                        )}
                        {isSafeExternalLink(course.link) && (
                          <a href={course.link} target="_blank" rel="noreferrer" className="admin-btn admin-btn-ghost admin-btn-sm">
                            <Eye size={12} /> Bax
                          </a>
                        )}
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(course.id)}>
                          <Trash2 size={12} /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

export function UsersTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  // Axtarış SERVER tərəfdə aparılır: siyahı məhdudlaşdırıldığı üçün müştəri tərəfdə
  // filtrləmək yüklənməmiş istifadəçiləri gizlədərdi.
  const load = useCallback(async (query = '') => {
    setLoading(true);
    const res = await getAdminUsers(query);

    // Əvvəl uğursuz cavab sükutla udulurdu: 403/500 halında siyahı boş qalır və
    // ekranda "Nəticə tapılmadı" görünürdü — yəni səlahiyyət xətası "data yoxdur" kimi oxunurdu.
    if (res.success && res.data) {
      setUsers(res.data);
      setLoadError('');
      // Hədd dolduqda server bunu mesajda bildirir — admin siyahını tam sanmasın.
      setNotice(res.data.length > 0 ? (res.message ?? '') : '');
    } else {
      setUsers([]);
      setNotice('');
      setLoadError(res.message || 'Məlumat yüklənə bilmədi.');
    }

    setLoading(false);
  }, []);

  // Yazarkən hər hərfdə sorğu getməsin deyə 350 ms gecikmə.
  useEffect(() => {
    const timer = setTimeout(() => load(search), 350);
    return () => clearTimeout(timer);
  }, [search, load]);

  // Filtrləmə serverdə aparılır — burada təkrar süzgəc yoxdur.
  const filtered = users;

  const handleRoleChange = async (userId: string, role: string) => {
    const res = await changeUserRole(userId, role);
    if (res.success) { onToast(res.message, 'success'); load(search); }
    else onToast(res.errors?.[0] || 'Xəta', 'error');
  };

  const handleBlock = async (userId: string) => {
    const res = await toggleUserBlock(userId);
    if (res.success) { onToast(res.message, 'success'); load(search); }
    else onToast(res.errors?.[0] || 'Xəta', 'error');
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">İstifadəçi İdarəetməsi</h2>
        <p className="admin-page-subtitle">İstifadəçilərin rollarını dəyişin, hesabları idarə edin</p>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-header">
          <h3 className="admin-table-title"><Users size={16} /> İstifadəçilər ({filtered.length})</h3>
          <div className="admin-table-actions">
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="admin-search-input"
                style={{ paddingLeft: 32 }}
                type="text"
                placeholder="İstifadəçi axtar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {notice && !loading && (
          <div className="admin-filter-row" style={{ borderBottom: 'none' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{notice}</span>
          </div>
        )}

        {loading ? (
          <div className="admin-empty">⏳ Yüklənir...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">{loadError ? '⚠️' : '👤'}</div>
            {loadError || 'Nəticə tapılmadı'}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>İstifadəçi</th>
                  <th>E-poçt</th>
                  <th>Rol</th>
                  <th>E-poçt Təsdiq</th>
                  <th>Qeydiyyat</th>
                  <th>Status</th>
                  <th>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.firstName} {user.lastName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>@{user.nickname}</div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user.email}</td>
                    <td>
                      <select
                        value={primaryRole(user.roles)}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6,
                          padding: '3px 8px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {MANAGEABLE_ROLES.map(r => (
                          <option key={r} value={r} style={{ background: '#0d1526' }}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`admin-badge ${user.isEmailConfirmed ? 'approved' : 'pending'}`}>
                        {user.isEmailConfirmed ? '✓ Təsdiqlənib' : '⏳ Gözlənilir'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {user.joinDate}
                    </td>
                    <td>
                      <span className={`admin-badge ${user.isBlocked ? 'blocked' : 'active'}`}>
                        {user.isBlocked ? '🔒 Blok' : '✓ Aktiv'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`admin-btn admin-btn-sm ${user.isBlocked ? 'admin-btn-success' : 'admin-btn-danger'}`}
                        onClick={() => handleBlock(user.id)}
                      >
                        {user.isBlocked ? '🔓 Bloku Aç' : '🔒 Blokla'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exams Tab ─────────────────────────────────────────────────
export function ExamsTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAdminExams();

    // Əvvəl uğursuz cavab sükutla udulurdu: 403/500 halında siyahı boş qalır və
    // ekranda "Nəticə tapılmadı" görünürdü — yəni səlahiyyət xətası "data yoxdur" kimi oxunurdu.
    if (res.success && res.data) {
      setExams(res.data);
      setLoadError('');
    } else {
      setExams([]);
      setLoadError(res.message || 'Məlumat yüklənə bilmədi.');
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.instructor.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    // Bu əməliyyat KASKADLIDIR: kateqoriya ilə birlikdə içindəki bütün suallar da silinir.
    // Əvvəlki mətn yalnız "sessiya" deyirdi və 219 suallıq kateqoriyanın bir kliklə
    // yox olmasını gizlədirdi. İndi real təsir və sual sayı göstərilir.
    const exam = exams.find(e => e.id === id);
    const questionInfo = exam ? ` (${exam.duration})` : '';
    const warning =
      `DİQQƏT — bu əməliyyat kaskadlıdır.\n\n` +
      `"${exam?.title ?? id}" kateqoriyası${questionInfo} silinəcək.\n` +
      `Bu kateqoriyaya aid BÜTÜN suallar da birlikdə silinəcək və panel üzərindən geri qaytarıla bilməz.\n\n` +
      `Davam edilsin?`;

    if (!confirm(warning)) return;
    const res = await deleteExam(id);
    if (res.success) { onToast(res.message, 'success'); load(); }
    else onToast(res.errors?.[0] || 'Xəta', 'error');
  };

  const statusMap: Record<string, string> = {
    'Aktiv': 'active', 'Gözlənilir': 'pending', 'Tamamlandı': 'completed',
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">İmtahan Sessiyaları</h2>
        <p className="admin-page-subtitle">Aktiv və gözlənilən imtahan sessiyalarını idarə edin</p>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-header">
          <h3 className="admin-table-title"><ClipboardList size={16} /> Sessiyalar ({filtered.length})</h3>
          <div className="admin-table-actions">
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="admin-search-input"
                style={{ paddingLeft: 32 }}
                type="text"
                placeholder="Sessiya axtar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty">⏳ Yüklənir...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">{loadError ? '⚠️' : '📋'}</div>
            {loadError || 'Nəticə tapılmadı'}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sessiya Kodu</th>
                  <th>Başlıq</th>
                  <th>Təlimçi</th>
                  <th>Kateqoriya</th>
                  <th>Tələbə</th>
                  <th>Müddət</th>
                  <th>Status</th>
                  <th>Tarix</th>
                  <th>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exam => (
                  <tr key={exam.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--brand-primary)' }}>{exam.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exam.title}</td>
                    <td>{exam.instructor}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exam.category}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{exam.studentCount}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{exam.duration}</td>
                    <td>
                      <span className={`admin-badge ${statusMap[exam.status]}`}>{exam.status}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{exam.createdAt}</td>
                    <td>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(exam.id)}>
                        <Trash2 size={12} /> Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Panel (Ana komponent) ───────────────────────────────
export default function AdminPanel({ onGoHome }: { onGoHome: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const loadStats = useCallback(async () => {
    const res = await getAdminStats();
    if (res.success && res.data) setStats(res.data);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
  }, []);

  const navItems: { tab: AdminTab; label: string; icon: React.ReactNode }[] = [
    { tab: 'dashboard', label: 'İcmal', icon: <LayoutDashboard size={16} /> },
    { tab: 'courses',   label: 'Təlimlər', icon: <BookOpen size={16} /> },
    { tab: 'users',     label: 'İstifadəçilər', icon: <Users size={16} /> },
    { tab: 'exams',     label: 'İmtahanlar', icon: <ClipboardList size={16} /> },
  ];

  return (
    <div className="admin-wrapper">
      {/* Top Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-logo">
          <div className="logo-icon-admin">
            <Shield size={18} color="var(--brand-primary)" strokeWidth={2} />
          </div>
          <span className="admin-topbar-title">Kiber<span>az.az</span></span>
          <span className="admin-topbar-badge">Admin</span>
        </div>
        <div className="admin-topbar-actions">
          <button className="admin-back-btn" onClick={onGoHome}>
            <ArrowLeft size={15} /> Ana Səhifəyə Qayıt
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="admin-body">
        {/* Sidebar */}
        <aside className="admin-sidebar" aria-label="Admin naviqasiya">
          {navItems.map(item => (
            <button
              key={item.tab}
              className={`admin-nav-item ${activeTab === item.tab ? 'active' : ''}`}
              onClick={() => setActiveTab(item.tab)}
              aria-current={activeTab === item.tab ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="admin-sidebar-divider" />
          <button className="admin-nav-item" onClick={onGoHome}>
            <ArrowLeft size={16} /> Ana Səhifə
          </button>
        </aside>

        {/* Main Content */}
        <main className="admin-content">
          {activeTab === 'dashboard' && <DashboardTab stats={stats} onRefresh={loadStats} />}
          {activeTab === 'courses'   && <CoursesTab onToast={showToast} />}
          {activeTab === 'users'     && <UsersTab onToast={showToast} />}
          {activeTab === 'exams'     && <ExamsTab onToast={showToast} />}
        </main>
      </div>

      {/* Toast bildirişi */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
