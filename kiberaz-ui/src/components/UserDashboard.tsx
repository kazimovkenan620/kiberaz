import { useState, useEffect } from 'react';
import {
  Shield, User, Mail, ChevronRight, LogOut,
  Globe, Zap, Target, TrendingUp,
  ClipboardList, CheckCircle, Clock, Star, Edit3, Home, Loader, BookOpen, Save, Users, Plus, UserPlus, School, Eye, Lock,
} from 'lucide-react';
import { addStudentToClass, createTeacherClass, getProfile, getStudentOverview, getTeacherClasses, requestEmailChange, requestPasswordChange, updateProfile } from '../services/userService';
import type { ProfileResponse, StudentOverviewResponse, TeacherClassResponse } from '../services/userService';
import './UserDashboard.css';

const genderLabel = (gender?: number) => gender === 2 ? 'female' : 'male';
const genderValue = (gender: string) => gender === 'female' ? 2 : 1;

// ── Sahə irəliləyişi ────────────────────────────────────────────
const categoryProgress = [
  { id: 'crypto', label: 'Kriptoqrafiya', icon: <BookOpen size={16} />, color: '#a855f7', solved: 34, total: 95, lastActive: '2 gün əvvəl' },
  { id: 'network', label: 'Şəbəkə Təhlükəsizliyi', icon: <Globe size={16} />, color: '#3b82f6', solved: 67, total: 130, lastActive: 'Bu gün' },
  { id: 'web', label: 'Veb Təhlükəsizliyi', icon: <Zap size={16} />, color: '#ef4444', solved: 42, total: 175, lastActive: 'Dünən' },
  { id: 'general', label: 'Ümumi Hazırlıq', icon: <Shield size={16} />, color: '#00e5a0', solved: 55, total: 140, lastActive: '3 gün əvvəl' },
];

// ── Son imtahan sessiyaları ──────────────────────────────────────
const recentSessions = [
  { id: 'S1', title: 'Network Security Final', date: '10 May 2025', score: 85, total: 20, duration: '45 dəq', status: 'Tamamlandı' },
  { id: 'S2', title: 'Web Security Quiz', date: '07 May 2025', score: 72, total: 15, duration: '30 dəq', status: 'Tamamlandı' },
  { id: 'S3', title: 'Kriptoqrafiya Test', date: '03 May 2025', score: 60, total: 10, duration: '20 dəq', status: 'Tamamlandı' },
];

// ── Tab tipləri ──────────────────────────────────────────────────
type Tab = 'overview' | 'progress' | 'sessions' | 'students' | 'profile';

interface Props {
  onLogout: () => void;
  onGoHome?: () => void;
}

// ════════════════════════════════════════════════════════════════
export default function UserDashboard({ onLogout, onGoHome }: Props) {
  const storedUser = localStorage.getItem('user');
  const cachedUser = storedUser ? JSON.parse(storedUser) : {};

  const [tab, setTab] = useState<Tab>('overview');
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentOverview, setStudentOverview] = useState<StudentOverviewResponse | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassResponse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [className, setClassName] = useState('');
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState('');
  const [classMsg, setClassMsg] = useState('');
  const [form, setForm] = useState({
    firstName: cachedUser.firstName ?? '',
    lastName: cachedUser.lastName ?? '',
    nickname: cachedUser.nickname ?? '',
    gender: genderLabel(cachedUser.gender),
  });

  // ── API-dən canlı profil çək ──────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getProfile();
        if (res.success && res.data) {
          setProfile(res.data);
          setForm({
            firstName: res.data.firstName,
            lastName: res.data.lastName,
            nickname: res.data.nickname,
            gender: genderLabel(res.data.gender),
          });
          if (res.data.roles.includes('Teacher')) {
            setClassLoading(true);
            const classesRes = await getTeacherClasses();
            if (classesRes.success && classesRes.data) {
              const classes = classesRes.data;
              setTeacherClasses(classes);
              setSelectedClassId(current => current ?? classes[0]?.id ?? null);
            } else {
              setClassError(classesRes.errors?.[0] || classesRes.message || 'Siniflər yüklənə bilmədi.');
            }
            setClassLoading(false);
          }
        } else {
          setApiError('Profil yüklənə bilmədi.');
        }
      } catch {
        setApiError('Serverə qoşulmaq mümkün olmadı.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const realNickname = profile?.nickname ?? cachedUser.nickname ?? 'İstifadəçi';
  const realJoinDate = profile?.joinDate
    ? new Date(profile.joinDate).toLocaleDateString('az-AZ')
    : '-';
  const realRoles: string[] = profile?.roles ?? cachedUser.roles ?? ['User'];
  const isTeacher = realRoles.includes('Teacher');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState('');
  const [securityError, setSecurityError] = useState('');

  const handleSave = async () => {
    setSaving(true); setSaveMsg(''); setSaveError('');
    try {
      const genderNum = genderValue(form.gender);
      const res = await updateProfile({ firstName: form.firstName, lastName: form.lastName, nickname: form.nickname, gender: genderNum });
      if (res.success && res.data) {
        setProfile(res.data);
        setForm({
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          nickname: res.data.nickname,
          gender: genderLabel(res.data.gender),
        });
        setSaveMsg('✅ Profil uğurla yeniləndi!');
        setEditMode(false);
      } else {
        setSaveError(res.errors?.[0] || res.message || 'Xəta baş verdi.');
      }
    } catch { setSaveError('Serverlə əlaqə yaradıla bilmədi.'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 4000); }
  };

  const handleEmailChange = async () => {
    setSecurityLoading(true); setSecurityMsg(''); setSecurityError('');
    try {
      const res = await requestEmailChange(newEmail);
      if (res.success) setSecurityMsg(res.message || 'Təsdiq linki cari e-poçta göndərildi.');
      else setSecurityError(res.errors?.[0] || res.message || 'E-poçt dəyişmə sorğusu alınmadı.');
    } catch {
      setSecurityError('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setSecurityLoading(true); setSecurityMsg(''); setSecurityError('');
    try {
      const res = await requestPasswordChange();
      if (res.success) setSecurityMsg(res.message || 'Şifrə yeniləmə linki e-poçta göndərildi.');
      else setSecurityError(res.errors?.[0] || res.message || 'Şifrə sorğusu alınmadı.');
    } catch {
      setSecurityError('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const totalSolved = categoryProgress.reduce((s, c) => s + c.solved, 0);
  const totalQ = categoryProgress.reduce((s, c) => s + c.total, 0);
  const overallPct = Math.round((totalSolved / totalQ) * 100);
  const selectedClass = teacherClasses.find(item => item.id === selectedClassId) ?? teacherClasses[0] ?? null;

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = className.trim();
    setClassError('');
    setClassMsg('');

    if (!name) {
      setClassError('Sinif adı daxil edin.');
      return;
    }

    setClassLoading(true);
    try {
      const res = await createTeacherClass(name);
      if (res.success && res.data) {
        setTeacherClasses(prev => [res.data!, ...prev]);
        setSelectedClassId(res.data.id);
        setClassName('');
        setClassMsg('Sinif yaradıldı.');
      } else {
        setClassError(res.errors?.[0] || res.message || 'Sinif yaradılmadı.');
      }
    } catch {
      setClassError('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setClassLoading(false);
    }
  };

  const handleAddStudentToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = studentId.trim();
    setStudentError('');
    setClassMsg('');
    setStudentOverview(null);

    if (!selectedClassId) {
      setStudentError('Əvvəlcə sinif seçin və ya yeni sinif açın.');
      return;
    }

    if (!id) {
      setStudentError('Tələbə ID-si daxil edin.');
      return;
    }

    setStudentLoading(true);
    try {
      const res = await addStudentToClass(selectedClassId, id);
      if (res.success && res.data) {
        setTeacherClasses(prev => prev.map(item => item.id === res.data!.id ? res.data! : item));
        setStudentId('');
        setClassMsg('Tələbə sinfə əlavə edildi.');
      } else {
        setStudentError(res.errors?.[0] || res.message || 'Tələbə sinfə əlavə edilmədi.');
      }
    } catch {
      setStudentError('Serverlə əlaqə yaradılmadı.');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleViewStudent = async (id: string) => {
    setStudentError('');
    setStudentOverview(null);
    setStudentLoading(true);
    try {
      const res = await getStudentOverview(id);
      if (res.success && res.data) {
        setStudentOverview(res.data);
      } else {
        setStudentError(res.errors?.[0] || res.message || 'Tələbə göstəriciləri açılmadı.');
      }
    } catch {
      setStudentError('Serverlə əlaqə yaradılmadı.');
    } finally {
      setStudentLoading(false);
    }
  };

  // API cavab verməyənə qədər loading göstər
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: 'var(--bg-primary)' }}>
      <Loader size={40} color="var(--brand-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)' }}>Profil yüklənir...</p>
    </div>
  );

  if (apiError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: 'var(--bg-primary)' }}>
      <p style={{ color: '#ef4444', fontSize: '1.1rem' }}>⚠️ {apiError}</p>
      <button className="ud-btn-primary" onClick={onGoHome}>Ana Səhifəyə Qayıt</button>
    </div>
  );

  return (
    <div className="ud-wrapper">
      {/* ── Sidebar ── */}
      <aside className="ud-sidebar">
        <div className="ud-sidebar-top">
          <div className="ud-avatar">{realNickname.slice(0, 2).toUpperCase()}</div>
          <div className="ud-sidebar-name" style={{ color: 'var(--brand-primary)' }}>{realNickname}</div>
          <div className="ud-sidebar-email">İstifadəçi Kabinetim</div>
        </div>

        <nav className="ud-nav">
          {([
            ['overview', 'Ümumi Baxış', <TrendingUp size={16} />],
            ['progress', 'İrəliləyiş', <Target size={16} />],
            ['sessions', 'İmtahanlarım', <ClipboardList size={16} />],
            ...(isTeacher ? [['students', 'Tələbələr', <Users size={16} />] as [Tab, string, React.ReactNode]] : []),
            ['profile', 'Profil', <User size={16} />],
          ] as [Tab, string, React.ReactNode][]).map(([t, label, icon]) => (
            <button
              key={t}
              className={`ud-nav-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {icon} {label}
              {tab === t && <ChevronRight size={14} className="ud-nav-arrow" />}
            </button>
          ))}
        </nav>

        <button className="ud-logout-btn" onClick={onGoHome} style={{ marginBottom: '8px', background: 'rgba(255,255,255,0.05)' }}>
          <Home size={15} /> Ana Səhifə
        </button>
        <button className="ud-logout-btn" onClick={onLogout}>
          <LogOut size={15} /> Çıxış
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main className="ud-main">

        {/* ═══ OVERVIEW ═══ */}
        {tab === 'overview' && (
          <div className="ud-section ud-overview">
            <div className="ud-section-header">
              <h1 className="ud-page-title">
                Xoş gəldiniz, <span>{realNickname}!</span>
              </h1>
              <p className="ud-page-sub">Bugünkü öyrənmə statistikanız</p>
            </div>

            {/* Stats */}
            <div className="ud-stats-grid">
              {[
                { icon: <CheckCircle size={20} />, color: '#00e5a0', label: 'Həll edilən sual', value: totalSolved },
                { icon: <Target size={20} />, color: '#3b82f6', label: 'Ümumi irəliləyiş', value: `${overallPct}%` },
                { icon: <ClipboardList size={20} />, color: '#f5a623', label: 'Keçirilən imtahan', value: recentSessions.length },
                { icon: <Star size={20} />, color: '#a855f7', label: 'Ortalama xal', value: '72%' },
              ].map((s, i) => (
                <div key={i} className="ud-stat-card" style={{ '--s-clr': s.color } as React.CSSProperties}>
                  <div className="ud-stat-icon">{s.icon}</div>
                  <div className="ud-stat-val">{s.value}</div>
                  <div className="ud-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Qısa kateqoriya baxışı */}
            <div className="ud-card">
              <div className="ud-card-title">📊 Sahə üzrə irəliləyiş</div>
              <div className="ud-progress-list">
                {categoryProgress.map(cat => {
                  const pct = Math.round((cat.solved / cat.total) * 100);
                  return (
                    <div key={cat.id} className="ud-prog-row" style={{ '--c-clr': cat.color } as React.CSSProperties}>
                      <span className="ud-prog-icon">{cat.icon}</span>
                      <div className="ud-prog-info">
                        <div className="ud-prog-label">{cat.label}</div>
                        <div className="ud-prog-bar-wrap">
                          <div className="ud-prog-bar">
                            <div className="ud-prog-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="ud-prog-pct">{pct}%</span>
                        </div>
                      </div>
                      <span className="ud-prog-count">{cat.solved}/{cat.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Son imtahan */}
            <div className="ud-card">
              <div className="ud-card-title">📝 Son imtahan sessiyaları</div>
              {recentSessions.slice(0, 2).map(s => (
                <div key={s.id} className="ud-session-row">
                  <div className="ud-session-info">
                    <div className="ud-session-title">{s.title}</div>
                    <div className="ud-session-meta"><Clock size={11} /> {s.duration} · {s.date}</div>
                  </div>
                  <div className="ud-session-score" style={{ color: s.score >= 70 ? '#00e5a0' : s.score >= 50 ? '#f5a623' : '#ef4444' }}>
                    {s.score}/{s.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PROGRESS ═══ */}
        {tab === 'progress' && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2 className="ud-page-title">Sahə üzrə <span>İrəliləyiş</span></h2>
              <p className="ud-page-sub">Hər kateqoriyada nə qədər irəlilədiniz</p>
            </div>

            <div className="ud-progress-cards">
              {categoryProgress.map(cat => {
                const pct = Math.round((cat.solved / cat.total) * 100);
                return (
                  <div key={cat.id} className="ud-prog-card" style={{ '--c-clr': cat.color } as React.CSSProperties}>
                    <div className="ud-prog-card-top">
                      <div className="ud-prog-card-icon">{cat.icon}</div>
                      <div>
                        <div className="ud-prog-card-label">{cat.label}</div>
                        <div className="ud-prog-card-meta">Son fəallıq: {cat.lastActive}</div>
                      </div>
                      <div className="ud-prog-card-pct">{pct}%</div>
                    </div>
                    <div className="ud-prog-bar-wrap" style={{ marginTop: 'var(--sp-4)' }}>
                      <div className="ud-prog-bar ud-prog-bar--lg">
                        <div className="ud-prog-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="ud-prog-card-footer">
                      <span>{cat.solved} sual həll edildi</span>
                      <span>{cat.total - cat.solved} sual qalıb</span>
                    </div>
                    <button className="ud-continue-btn" onClick={() => {/* TODO */ }}>
                      Davam et <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ SESSIONS ═══ */}
        {tab === 'sessions' && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2 className="ud-page-title">İmtahan <span>Sessiyalarım</span></h2>
              <p className="ud-page-sub">Keçirilən bütün sessiyaların nəticələri</p>
            </div>

            <div className="ud-sessions-table">
              <div className="ud-table-head">
                <span>Sessiya</span>
                <span>Tarix</span>
                <span>Müddət</span>
                <span>Xal</span>
                <span>Status</span>
              </div>
              {recentSessions.map(s => {
                const pct = Math.round((s.score / s.total) * 100);
                const clr = pct >= 70 ? '#00e5a0' : pct >= 50 ? '#f5a623' : '#ef4444';
                return (
                  <div key={s.id} className="ud-table-row">
                    <span className="ud-table-title">{s.title}</span>
                    <span className="ud-table-meta">{s.date}</span>
                    <span className="ud-table-meta"><Clock size={11} /> {s.duration}</span>
                    <span className="ud-table-score" style={{ color: clr }}>{s.score}/{s.total} ({pct}%)</span>
                    <span className="ud-table-status" style={{ color: '#00e5a0' }}>
                      <CheckCircle size={12} /> {s.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {tab === 'students' && isTeacher && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2 className="ud-page-title">Sinif <span>Izleme</span></h2>
              <p className="ud-page-sub">Sinif açın, tələbə ID-si ilə şagird əlavə edin və göstəricilərini izləyin</p>
            </div>

            <div className="ud-card ud-class-manager-card">
              <div className="ud-card-title"><School size={15} /> Sinif idarəetməsi</div>
              <div className="ud-class-manager-grid">
                <form className="ud-student-search" onSubmit={handleCreateClass}>
                  <div className="form-field">
                    <label htmlFor="class-name"><School size={12} /> Yeni sinif adı</label>
                    <input
                      id="class-name"
                      type="text"
                      placeholder="Məsələn: Kiber təhlükəsizlik 101"
                      value={className}
                      onChange={e => setClassName(e.target.value)}
                    />
                  </div>
                  <button className="ud-btn-primary" type="submit" disabled={classLoading}>
                    {classLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />}
                    Sinif aç
                  </button>
                </form>

                <form className="ud-student-search" onSubmit={handleAddStudentToClass}>
                  <div className="form-field">
                    <label htmlFor="student-id-search"><User size={12} /> Tələbə ID-si</label>
                    <input
                      id="student-id-search"
                      type="text"
                      placeholder="Məsələn: 7f3c..."
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                      disabled={!selectedClass}
                    />
                  </div>
                  <button className="ud-btn-primary" type="submit" disabled={studentLoading || !selectedClass}>
                    {studentLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={15} />}
                    Əlavə et
                  </button>
                </form>
              </div>

              <div className="ud-class-list">
                {classLoading && teacherClasses.length === 0 && <p className="ud-helper-text">Siniflər yüklənir...</p>}
                {!classLoading && teacherClasses.length === 0 && <p className="ud-helper-text">Hələ sinif yoxdur. İlk sinfi açaraq tələbələri ora əlavə edin.</p>}
                {teacherClasses.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ud-class-item ${selectedClass?.id === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedClassId(item.id);
                      setStudentOverview(null);
                      setStudentError('');
                    }}
                  >
                    <span>{item.name}</span>
                    <small>{item.studentCount} tələbə</small>
                  </button>
                ))}
              </div>

                <p className="ud-helper-text">
                  {selectedClass
                    ? `"${selectedClass.name}" sinfinə əlavə edilən tələbələr aşağıda izlənəcək.`
                    : 'Tələbə əlavə etmək üçün əvvəl sinif seçin.'}
                </p>
                {classMsg && <p className="ud-inline-success">{classMsg}</p>}
                {classError && <p className="ud-inline-error">{classError}</p>}
                {studentError && <p className="ud-inline-error">{studentError}</p>}
              </div>

            {selectedClass && (
              <div className="ud-sessions-table ud-class-students-table">
                <div className="ud-table-head">
                  <span>Tələbə</span>
                  <span>Ortalama</span>
                  <span>İmtahan</span>
                  <span>İrəliləyiş</span>
                  <span>Baxış</span>
                </div>
                {selectedClass.students.length === 0 ? (
                  <div className="ud-empty-row">Bu sinifdə hələ tələbə yoxdur.</div>
                ) : selectedClass.students.map(student => (
                  <div key={student.id} className="ud-table-row">
                    <span className="ud-table-title">
                      {student.firstName} {student.lastName}
                      <small>@{student.nickname}</small>
                    </span>
                    <span className="ud-table-score">{student.summary.averageScore}%</span>
                    <span className="ud-table-meta">{student.summary.examsTaken}</span>
                    <span className="ud-table-score" style={{ color: student.summary.overallProgress >= 70 ? '#00e5a0' : student.summary.overallProgress >= 50 ? '#f5a623' : '#ef4444' }}>
                      {student.summary.overallProgress}%
                    </span>
                    <span>
                      <button className="ud-icon-btn" type="button" onClick={() => handleViewStudent(student.id)} disabled={studentLoading}>
                        <Eye size={15} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {studentOverview && (
              <div className="ud-student-panel">
                <div className="ud-student-head">
                  <div className="ud-avatar">{studentOverview.nickname.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <h3>{studentOverview.firstName} {studentOverview.lastName}</h3>
                    <p>@{studentOverview.nickname}</p>
                    <code>{studentOverview.id}</code>
                  </div>
                </div>

                <div className="ud-stats-grid">
                  {[
                    { icon: <ClipboardList size={20} />, color: '#f5a623', label: 'İmtahan sayı', value: studentOverview.summary.examsTaken },
                    { icon: <Target size={20} />, color: '#3b82f6', label: 'Ortalama xal', value: `${studentOverview.summary.averageScore}%` },
                    { icon: <Star size={20} />, color: '#a855f7', label: 'Ən yaxşı nəticə', value: `${studentOverview.summary.bestScore}%` },
                    { icon: <CheckCircle size={20} />, color: '#00e5a0', label: 'Ümumi irəliləyiş', value: `${studentOverview.summary.overallProgress}%` },
                  ].map((s, i) => (
                    <div key={i} className="ud-stat-card" style={{ '--s-clr': s.color } as React.CSSProperties}>
                      <div className="ud-stat-icon">{s.icon}</div>
                      <div className="ud-stat-val">{s.value}</div>
                      <div className="ud-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="ud-card">
                  <div className="ud-card-title">Sahə üzrə göstəricilər</div>
                  <div className="ud-progress-list">
                    {studentOverview.progressAreas.map(area => (
                      <div key={area.area} className="ud-prog-row" style={{ '--c-clr': '#00d4ff' } as React.CSSProperties}>
                        <span className="ud-prog-icon"><BookOpen size={16} /></span>
                        <div className="ud-prog-info">
                          <div className="ud-prog-label">{area.area}</div>
                          <div className="ud-prog-bar-wrap">
                            <div className="ud-prog-bar">
                              <div className="ud-prog-fill" style={{ width: `${area.percentage}%` }} />
                            </div>
                            <span className="ud-prog-pct">{area.percentage}%</span>
                          </div>
                        </div>
                        <span className="ud-prog-count">{area.solved}/{area.total}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ud-sessions-table">
                  <div className="ud-table-head">
                    <span>Sessiya</span>
                    <span>Tarix</span>
                    <span>Xal</span>
                    <span>Faiz</span>
                    <span>Status</span>
                  </div>
                  {studentOverview.examSessions.map(session => (
                    <div key={session.id} className="ud-table-row">
                      <span className="ud-table-title">{session.title}</span>
                      <span className="ud-table-meta">{new Date(session.date).toLocaleDateString('az-AZ')}</span>
                      <span className="ud-table-score">{session.score}/{session.maxScore}</span>
                      <span className="ud-table-score" style={{ color: session.percentage >= 70 ? '#00e5a0' : session.percentage >= 50 ? '#f5a623' : '#ef4444' }}>{session.percentage}%</span>
                      <span className="ud-table-status" style={{ color: '#00e5a0' }}><CheckCircle size={12} /> {session.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {tab === 'profile' && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2 className="ud-page-title">Mənim <span>Profilim</span></h2>
              <p className="ud-page-sub">Şəxsi məlumatlarınızı idarə edin</p>
            </div>

            <div className="ud-profile-card">
              {/* Avatar */}
              <div className="ud-profile-avatar-wrap">
                <div className="ud-avatar" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                  {realNickname.slice(0, 2).toUpperCase()}
                </div>
              </div>

              {/* Rol badge-ləri */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', margin: '0 0 var(--sp-5)' }}>
                {realRoles.map((role: string) => {
                  type RoleKey = 'Admin' | 'Moderator' | 'VIP' | 'Teacher' | 'User';
                  const roleConfig: Record<RoleKey, { label: string; color: string; bg: string; icon: string }> = {
                    Admin: { label: 'Admin', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '🛡️' },
                    Moderator: { label: 'Moderator', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', icon: '🔨' },
                    VIP: { label: 'VIP', color: '#f5a623', bg: 'rgba(245,166,35,0.15)', icon: '👑' },
                    Teacher: { label: 'Müəllim', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: 'T' },
                    User: { label: 'İstifadəçi', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '👤' },
                  };
                  const cfg = roleConfig[role as RoleKey] || roleConfig['User'];
                  return (
                    <span key={role} style={{
                      padding: '5px 16px', borderRadius: '20px', fontSize: '0.82rem',
                      fontWeight: 600, letterSpacing: '0.04em',
                      color: cfg.color, background: cfg.bg,
                      border: `1px solid ${cfg.color}55`,
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  );
                })}
              </div>

              {/* Fields */}
              <div className="ud-profile-fields">
                <div className="ud-prof-row">
                  <div className="form-field">
                    <label><User size={12} /> Ad</label>
                    <input id="ud-first" type="text" value={form.firstName}
                      disabled={!editMode}
                      onChange={e => set('firstName', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label><User size={12} /> Soyad</label>
                    <input id="ud-last" type="text" value={form.lastName}
                      disabled={!editMode}
                      onChange={e => set('lastName', e.target.value)} />
                  </div>
                </div>
                {/* Email */}
                {profile?.email && (
                  <div className="form-field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={12} /> E-poçt
                    </label>
                    <input id="ud-email" type="email" value={profile.email} disabled style={{ opacity: 0.75 }} />
                  </div>
                )}
                <div className="form-field">
                  <label><Mail size={12} /> Yeni e-poçt</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input id="ud-new-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="yeni-email@gmail.com" style={{ flex: '1 1 220px' }} />
                    <button className="ud-btn-outline" type="button" onClick={handleEmailChange} disabled={securityLoading || !newEmail.trim()}>
                      Təsdiq linki göndər
                    </button>
                  </div>
                  <span className="ud-helper-text">Email əvvəl cari ünvandan təsdiqlənir, sonra yeni ünvana gələn linklə aktivləşir.</span>
                </div>
                <div className="form-field">
                  <label><Lock size={12} /> Şifrə</label>
                  <button className="ud-btn-outline" type="button" onClick={handlePasswordChange} disabled={securityLoading}>
                    Şifrə yeniləmə linki göndər
                  </button>
                  <span className="ud-helper-text">Link təsdiqli email ünvanına göndərilir və yeni şifrə link üzərindən yazılır.</span>
                </div>
                {securityMsg && <p style={{ color: '#00e5a0', textAlign: 'center', margin: '10px 0', fontWeight: 500 }}>{securityMsg}</p>}
                {securityError && <p style={{ color: '#ef4444', textAlign: 'center', margin: '10px 0' }}>{securityError}</p>}
                <div className="form-field">
                  <label><User size={12} /> Ləqəb (Nickname)</label>
                  <input id="ud-nickname" type="text" value={form.nickname}
                    disabled={!editMode}
                    onChange={e => set('nickname', e.target.value)} />
                </div>
                {profile?.id && (
                  <div className="form-field">
                    <label><User size={12} /> İstifadəçi ID-si</label>
                    <input id="ud-user-id" type="text" value={profile.id} disabled style={{ opacity: 0.75 }} />
                    <span className="ud-helper-text">Bu ID-ni müəlliminizlə paylaşaraq göstəricilərinizin izlənməsinə icazə verə bilərsiniz.</span>
                  </div>
                )}

                {/* Cins — Radio Button */}
                <div className="form-field">
                  <label style={{ marginBottom: '10px', display: 'block' }}><User size={12} /> Cins</label>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    {[['Kişi', 'male'], ['Qadın', 'female']].map(([label, val]) => (
                      <label key={val} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: editMode ? 'pointer' : 'default',
                        color: form.gender === val ? 'var(--brand-primary)' : 'var(--text-muted)',
                        fontWeight: form.gender === val ? 600 : 400,
                        fontSize: '0.9rem', transition: 'color 0.2s',
                      }}>
                        <input
                          type="radio" name="ud-gender" value={val}
                          disabled={!editMode}
                          checked={form.gender === val}
                          onChange={() => set('gender', val)}
                          style={{ accentColor: 'var(--brand-primary)', width: '16px', height: '16px' }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Uğur / Xəta mesajı */}
              {saveMsg && <p style={{ color: '#00e5a0', textAlign: 'center', margin: '10px 0', fontWeight: 500 }}>{saveMsg}</p>}
              {saveError && <p style={{ color: '#ef4444', textAlign: 'center', margin: '10px 0' }}>{saveError}</p>}

              {/* Actions */}
              <div className="ud-profile-actions">
                {editMode ? (
                  <>
                    <button className="ud-btn-primary" onClick={handleSave} disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', opacity: saving ? 0.7 : 1 }}>
                      {saving
                        ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saxlanılır...</>
                        : <><Save size={15} /> Yadda Saxla</>
                      }
                    </button>
                    <button className="ud-btn-outline" onClick={() => {
                      setForm({
                        firstName: profile?.firstName ?? '',
                        lastName: profile?.lastName ?? '',
                        nickname: profile?.nickname ?? '',
                        gender: genderLabel(profile?.gender),
                      });
                      setEditMode(false);
                      setSaveError('');
                    }}>
                      Ləğv et
                    </button>
                  </>
                ) : (
                  <button className="ud-btn-primary" onClick={() => setEditMode(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Edit3 size={15} /> Məlumatları Redaktə Et
                  </button>
                )}
              </div>

              {/* Meta */}
              <div className="ud-profile-meta">
                <span>🗓 Qeydiyyat tarixi: {realJoinDate}</span>
                <span>·</span>
                <span style={{ color: '#00e5a0' }}>✓ Aktiv Hesab</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
