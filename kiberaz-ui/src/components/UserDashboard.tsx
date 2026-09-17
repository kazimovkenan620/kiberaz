import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, User, Mail, ChevronRight, LogOut, Target, TrendingUp, ClipboardList, CheckCircle, Clock, Star,
  Edit3, Home, BookOpen, Save, Users, Plus, UserPlus, School, Eye, Lock, Copy, Check, Trash2, ArrowLeftRight,
  AlertTriangle, Trophy, Activity, Calendar, KeyRound, X, Layers, BarChart2, Crown,
} from 'lucide-react';
import { addStudentToClass, changeRole, createTeacherClass, deleteTeacherClass, getMyOverview, getProfile, getStudentOverview, getTeacherClasses, requestEmailChange, requestPasswordChange, updateProfile } from '../services/userService';
import type { ProfileResponse, StudentOverviewResponse, SwitchableRole, TeacherClassResponse } from '../services/userService';
import { isAdmin } from '../services/authService';
import { getAdminStats, type AdminStats } from '../services/adminService';
import { CoursesTab, DashboardTab, UsersTab } from './AdminPanel';
import AdminExamsTab from './AdminExamsTab';
import AdminBankTab from './AdminBankTab';
import MyCoursesTab from './MyCoursesTab';
import { getMyCourses } from '../services/courseService';
import DashboardShell from './layout/DashboardShell';
import Sidebar, { SidebarPromo } from './layout/Sidebar';
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, ErrorState, FormField, IconButton, LoadingState, ProgressBar, StatCard, Toast } from './ui';
import './UserDashboard.css';

const genderLabel = (gender?: number) => gender === 2 ? 'female' : 'male';
const genderValue = (gender: string) => gender === 'female' ? 2 : 1;

// "Son fəallıq" mətnini ISO tarixdən qurur.
function relativeTime(iso: string | null): string {
  if (!iso) return 'Fəallıq yoxdur';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Fəallıq yoxdur';

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Bu gün';
  if (days === 1) return 'Dünən';
  if (days < 30) return `${days} gün əvvəl`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 ay əvvəl' : `${months} ay əvvəl`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Nəticə faizinə görə ton — rəng tək başına məna daşımır, faiz həmişə yanında yazılır.
const scoreTone = (pct: number): 'success' | 'warning' | 'danger' => pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'danger';

// Rol nişanları — yalnız göstərmə üçün, səlahiyyət serverdədir.
const ROLE_BADGES: Record<string, { label: string; tone: 'brand' | 'info' | 'success' | 'warning' | 'neutral' }> = {
  Admin: { label: 'Admin', tone: 'brand' },
  Moderator: { label: 'Moderator', tone: 'info' },
  VIP: { label: 'VIP', tone: 'warning' },
  Teacher: { label: 'Müəllim', tone: 'success' },
  User: { label: 'İstifadəçi', tone: 'neutral' },
};

// ── Tab tipləri ──────────────────────────────────────────────────
type Tab =
  | 'overview' | 'progress' | 'sessions' | 'students' | 'courses' | 'profile'
  // Admin bölmələri — yalnız Admin rolunda göstərilir.
  | 'adm-overview' | 'adm-users' | 'adm-courses' | 'adm-exams' | 'adm-bank';

// Admin tablarının siyahısı bir yerdədir: yeni bölmə əlavə edəndə şərti
// hər yerdə təkrar yazmaq lazım gəlmir, bu massivə bir sətir yazılır.
const ADMIN_TABS: Tab[] = ['adm-overview', 'adm-users', 'adm-courses', 'adm-exams', 'adm-bank'];

interface Props {
  onLogout: () => void;
  onGoHome?: () => void;
}

// ════════════════════════════════════════════════════════════════
export default function UserDashboard({ onLogout, onGoHome }: Props) {
  // Admin vəziyyəti bir dəfə oxunur və TƏK QAPI kimi işlədilir —
  // hər bölmədə ayrı-ayrı isAdmin() çağırmaq unudulma riski yaradır.
  const [isAdminUser] = useState<boolean>(() => isAdmin());
  const [tab, setTab] = useState<Tab>(() => isAdmin() ? 'adm-overview' : 'overview');
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminToast, setAdminToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showAdminToast = useCallback(
    (msg: string, type: 'success' | 'error') => setAdminToast({ msg, type }),
    [],
  );

  const loadAdminStats = useCallback(async () => {
    if (!isAdmin()) return;
    const res = await getAdminStats();
    setAdminStats(res.success && res.data ? res.data : null);
  }, []);

  // Statistika yalnız admin bölməsi açılanda çəkilir — adi istifadəçi
  // kabinetə girəndə lazımsız (və onsuz da 403 alacaq) sorğu getmir.
  useEffect(() => {
    if (!isAdminUser || !ADMIN_TABS.includes(tab)) return;

    let cancelled = false;
    void getAdminStats().then((res) => {
      if (!cancelled) {
        setAdminStats(res.success && res.data ? res.data : null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tab, isAdminUser]);
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentOverview, setStudentOverview] = useState<StudentOverviewResponse | null>(null);

  // Kabinetin BÜTÜN göstəriciləri buradan gəlir.
  const [myOverview, setMyOverview] = useState<StudentOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassResponse[]>([]);
  // "Təlimlərim" VIP-ə həmişə, başqalarına yalnız paylaşdığı təlim varsa göstərilir
  // (VIP bitəndən sonra da təlimləri idarə edə/silə bilsin).
  const [hasOwnCourses, setHasOwnCourses] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [className, setClassName] = useState('');
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState('');
  const [classMsg, setClassMsg] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    gender: '',
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
          if (!isAdminUser && !res.data.roles.includes('VIP')) {
            getMyCourses().then(mine => setHasOwnCourses(Boolean(mine.success && mine.data && mine.data.length > 0)))
              .catch(() => { /* tab sadəcə gizli qalır */ });
          }
          if (!isAdminUser && res.data.roles.includes('Teacher')) {
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
          // Serverin əsl mesajı göstərilir. Ümumi "yüklənə bilmədi" mətni səbəbi gizlədir:
          // 401 (sessiya köhnəlib), 403 (səlahiyyət) və 500 eyni görünürdü.
          setApiError(res.errors?.[0] || res.message || 'Profil yüklənə bilmədi.');
        }
      } catch {
        setApiError('Serverə qoşulmaq mümkün olmadı.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isAdminUser]);

  const realNickname = profile?.nickname ?? 'İstifadəçi';
  const realJoinDate = profile?.joinDate
    ? new Date(profile.joinDate).toLocaleDateString('az-AZ')
    : '-';
  const realRoles: string[] = profile?.roles ?? ['User'];
  const isTeacher = !isAdminUser && realRoles.includes('Teacher');
  const isVip = !isAdminUser && realRoles.includes('VIP');

  // ── Rol keçidi üçün törəmə dəyərlər ──────────────────────────
  // Yalnız İstifadəçi ⇄ Müəllim keçidi var. Admin bu kartı ümumiyyətlə görmür:
  // server admin hesabının rol keçidini rədd edir, ona görə düymə də göstərilmir.
  const currentRole: SwitchableRole = realRoles.includes('Teacher') ? 'Teacher' : 'User';
  const targetRole: SwitchableRole = currentRole === 'Teacher' ? 'User' : 'Teacher';
  const ROLE_LABELS: Record<SwitchableRole, string> = { User: 'İstifadəçi', Teacher: 'Müəllim' };

  // Müəllim → tələbə keçidini server sinif varsa bloklayır (BOŞ sinif də sayılır).
  // Şərti burada eyni məntiqlə təkrarlayırıq ki, istifadəçi düyməni basmadan
  // nəyin lazım olduğunu görsün — yekun qərar yenə serverindir.
  const blockingClasses: TeacherClassResponse[] = currentRole === 'Teacher' ? teacherClasses : [];
  const roleSwitchBlocked = blockingClasses.length > 0;

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [userIdCopied, setUserIdCopied] = useState(false);

  // ── Rol keçidi (tələbə ⇄ müəllim) ────────────────────────────
  // roleConfirm: təsdiq addımı. Rol keçidi sessiyanı bağlayır, ona görə
  // tək kliklə icra olunmur — istifadəçi nəticəni bilərək təsdiqləyir.
  const [roleConfirm, setRoleConfirm] = useState(false);
  const [roleSwitching, setRoleSwitching] = useState(false);
  const [roleMsg, setRoleMsg] = useState('');
  const [roleError, setRoleError] = useState('');
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);
  // Silmə birbaşa icra olunmur: əvvəlcə hansı sinfin silinəcəyi adı və tələbə sayı ilə
  // təsdiqlədilir. Sinif silinməsi geri qaytarıla bilməyən əməliyyatdır.
  const [classPendingDelete, setClassPendingDelete] = useState<TeacherClassResponse | null>(null);

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
        setSaveMsg('Profil uğurla yeniləndi.');
        setEditMode(false);
      } else {
        setSaveError(res.errors?.[0] || res.message || 'Xəta baş verdi.');
      }
    } catch { setSaveError('Serverlə əlaqə yaradıla bilmədi.'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 4000); }
  };

  const handleCopyUserId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id).then(() => {
      setUserIdCopied(true);
      setTimeout(() => setUserIdCopied(false), 2000);
    });
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

  // Sinifi silir. Müəllim → tələbə keçidi üçün server bütün siniflərin
  // silinməsini tələb edir, ona görə silmə düyməsi burada, keçid kartının içindədir.
  const handleDeleteClass = async (classId: number) => {
    setRoleError('');
    setRoleMsg('');
    setDeletingClassId(classId);
    try {
      const res = await deleteTeacherClass(classId);
      if (res.success) {
        // Yeni siyahı əvvəlcə hesablanır: setState updater-inin içindən başqa
        // setState çağırmaq StrictMode-da ikiqat icra olunan anti-pattern-dir.
        const next = teacherClasses.filter(item => item.id !== classId);
        setTeacherClasses(next);
        // Silinən sinif seçili idisə, seçimi boşda qoymuruq.
        setSelectedClassId(current => (current === classId ? next[0]?.id ?? null : current));
        setRoleMsg('Sinif silindi.');
        setClassPendingDelete(null);
      } else {
        setRoleError(res.errors?.[0] || res.message || 'Sinif silinmədi.');
        setClassPendingDelete(null);
      }
    } catch {
      setRoleError('Serverlə əlaqə yaradıla bilmədi.');
      setClassPendingDelete(null);
    } finally {
      setDeletingClassId(null);
    }
  };

  // Rol keçidi. Server uğur halında SecurityStamp-i yeniləyir və refresh token-i silir —
  // yəni cari access token növbəti sorğuda etibarsızdır. Ona görə burada mütləq
  // logout edilir: əks halda istifadəçi köhnə rolla "yarı-işləyən" kabinetdə qalar.
  const handleChangeRole = async () => {
    setRoleSwitching(true);
    setRoleError('');
    setRoleMsg('');
    try {
      const res = await changeRole(targetRole);
      if (res.success) {
        setRoleConfirm(false);
        setRoleMsg(res.message || 'Rol dəyişdirildi. Yenidən daxil olun.');
        // Mesaj oxunsun deyə qısa fasilə, sonra sessiya bağlanır.
        setTimeout(() => onLogout(), 2200);
      } else {
        setRoleError(res.errors?.[0] || res.message || 'Rol dəyişdirilmədi.');
      }
    } catch {
      setRoleError('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setRoleSwitching(false);
    }
  };

  // Öz göstəricilərini çək — ID serverdə token-dən götürülür.
  useEffect(() => {
    let cancelled = false;
    getMyOverview()
      .then(res => { if (!cancelled) setMyOverview(res.success && res.data ? res.data : null); })
      .finally(() => { if (!cancelled) setOverviewLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Sahə irəliləyişi — real dataya bağlıdır.
  const categoryProgress = useMemo(
    () => (myOverview?.progressAreas ?? []).map((area, i) => ({
      id: `area-${i}`,
      label: area.area,
      solved: area.solved,
      total: area.total,
      pct: area.total > 0 ? Math.round((area.solved / area.total) * 100) : 0,
      lastActive: relativeTime(area.lastActivity),
      lastActivityIso: area.lastActivity,
    })),
    [myOverview],
  );

  const recentSessions = useMemo(
    () => (myOverview?.examSessions ?? []).map(s => ({
      id: s.id,
      title: s.title,
      date: formatDate(s.date),
      score: s.score,
      total: s.maxScore,
      percentage: s.percentage,
      // Backend imtahan müddətini saxlamır (sessiya anlayışı yoxdur) — onun yerinə
      // həmin sahədə cavablanan sual sayı göstərilir.
      questionCount: s.maxScore,
      status: s.status,
    })),
    [myOverview],
  );

  // Son fəaliyyət: sahələr son fəallıq tarixinə görə (yalnız real tarixlər).
  const recentActivity = useMemo(
    () => categoryProgress
      .filter(a => a.lastActivityIso)
      .sort((a, b) => new Date(b.lastActivityIso!).getTime() - new Date(a.lastActivityIso!).getTime())
      .slice(0, 5),
    [categoryProgress],
  );

  const overallPct = myOverview?.summary.overallProgress ?? 0;
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

  // ── Yan panel ────────────────────────────────────────────────
  const navItems = isAdminUser
    ? [
        { id: 'adm-overview' as Tab, label: 'İcmal', icon: <Shield size={16} /> },
        { id: 'adm-users' as Tab, label: 'İstifadəçilər', icon: <Users size={16} /> },
        { id: 'adm-courses' as Tab, label: 'Təlimlər', icon: <BookOpen size={16} /> },
        { id: 'adm-exams' as Tab, label: 'İmtahan sessiyaları', icon: <ClipboardList size={16} /> },
        { id: 'adm-bank' as Tab, label: 'Kateqoriyalar + suallar', icon: <Layers size={16} /> },
      ]
    : [
        { id: 'overview' as Tab, label: 'Ümumi Baxış', icon: <Home size={16} /> },
        { id: 'progress' as Tab, label: 'İrəliləyiş', icon: <TrendingUp size={16} /> },
        { id: 'sessions' as Tab, label: 'İmtahanlarım', icon: <ClipboardList size={16} /> },
        ...(isTeacher ? [{ id: 'students' as Tab, label: 'Tələbələr', icon: <Users size={16} /> }] : []),
        ...(isVip || hasOwnCourses ? [{ id: 'courses' as Tab, label: 'Təlimlərim', icon: <Crown size={16} /> }] : []),
        { id: 'profile' as Tab, label: 'Profil', icon: <User size={16} /> },
      ];

  const roleBadge = (role: string) => ROLE_BADGES[role] ?? { label: role, tone: 'neutral' as const };
  const primaryRole = isAdminUser ? 'Admin' : isVip ? 'VIP' : currentRole;

  const sidebar = (
    <Sidebar
      title={isAdminUser ? 'İdarəetmə paneli' : 'Kabinet'}
      ariaLabel="Kabinet bölmələri"
      items={navItems}
      value={tab}
      onSelect={setTab}
      idPrefix="ud-nav"
      header={
        <div className="sidebar__user">
          <span className="avatar avatar--brand" aria-hidden="true">{realNickname.slice(0, 2)}</span>
          <span className="sidebar__user-text">
            <span className="sidebar__user-name">{realNickname}</span>
            <span className="sidebar__user-role">{roleBadge(primaryRole).label}</span>
          </span>
        </div>
      }
      footer={
        <>
          <div className="sidebar__footer">
            <button type="button" className="sidebar__item" onClick={onGoHome}><span className="sidebar__icon"><Home size={16} /></span><span className="sidebar__text"><span className="sidebar__label">Ana səhifə</span></span></button>
            <button type="button" className="sidebar__item" onClick={onLogout}><span className="sidebar__icon"><LogOut size={16} /></span><span className="sidebar__text"><span className="sidebar__label">Çıxış</span></span></button>
          </div>
          <SidebarPromo onClick={onGoHome} />
        </>
      }
    />
  );

  // API cavab verməyənə qədər loading göstər
  if (loading) return (
    <div className="ud-fullstate"><LoadingState text="Profil yüklənir..." /></div>
  );

  if (apiError) return (
    <div className="ud-fullstate">
      <ErrorState title="Kabinet açılmadı" text={apiError} />
      <Button variant="primary" onClick={onGoHome}><Home size={15} /> Ana səhifəyə qayıt</Button>
    </div>
  );

  // Statistika blokları (real sahələr: examsTaken, averageScore, bestScore, totalPoints)
  const summaryStats = (summary: StudentOverviewResponse['summary']) => (
    <div className="stat-grid">
      <StatCard icon={<Trophy size={18} />} tone="brand" value={summary.totalPoints.toLocaleString('az-AZ')} label="Toplam xal" />
      <StatCard icon={<ClipboardList size={18} />} tone="info" value={summary.examsTaken} label="İmtahan sayı" />
      <StatCard icon={<BarChart2 size={18} />} tone="success" value={`${summary.averageScore}%`} label="Orta nəticə" />
      <StatCard icon={<Star size={18} />} tone="warning" value={`${summary.bestScore}%`} label="Ən yaxşı nəticə" />
    </div>
  );

  const progressRows = (areas: { area: string; solved: number; total: number; percentage: number }[]) => (
    <div className="ud-progress-list">
      {areas.map(area => (
        <div key={area.area} className="ud-prog-row">
          <span className="ud-prog-icon" aria-hidden="true"><Layers size={15} /></span>
          <div className="ud-prog-info">
            <div className="ud-prog-top"><span className="ud-prog-label">{area.area}</span><span className="ud-prog-count">{area.solved}/{area.total}</span></div>
            <ProgressBar value={area.percentage} label={`${area.area}: ${area.percentage}%`} size="sm" showValue />
          </div>
        </div>
      ))}
    </div>
  );

  const sessionsTable = (rows: { id: string; title: string; date: string; questionCount?: number; score: number; total: number; percentage: number; status: string }[], showCount: boolean) => (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Sessiya</th>
            <th>Tarix</th>
            {showCount && <th className="is-num">Sual sayı</th>}
            <th className="is-num">Xal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.id}>
              <td className="cell-main">{s.title}</td>
              <td className="cell-muted">{s.date}</td>
              {showCount && <td className="is-num cell-muted">{s.questionCount}</td>}
              <td className="is-num"><strong>{s.score}/{s.total}</strong> <Badge tone={scoreTone(s.percentage)}>{s.percentage}%</Badge></td>
              <td><Badge tone="success"><CheckCircle size={12} /> {s.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Ümumi baxış üçün sağ sütun ──────────────────────────────
  const overviewRail = (
    <>
      <Card padded="sm">
        <CardHead icon={<Activity size={15} />} title="Son fəaliyyət" />
        {overviewLoading ? <LoadingState compact text="Yüklənir..." /> : recentActivity.length === 0 ? (
          <p className="note">Hələ fəaliyyət qeydə alınmayıb.</p>
        ) : (
          <ul className="ud-activity">
            {recentActivity.map(a => (
              <li key={a.id}>
                <span className="ud-activity__dot" aria-hidden="true" />
                <span className="ud-activity__body">
                  <span className="ud-activity__title">{a.label}</span>
                  <span className="ud-activity__meta">{a.solved}/{a.total} sual · {a.lastActive}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card padded="sm">
        <CardHead icon={<User size={15} />} title="Hesab" />
        <dl className="ud-kv">
          <div><dt>Rol</dt><dd>{realRoles.map(r => <Badge key={r} tone={roleBadge(r).tone}>{roleBadge(r).label}</Badge>)}</dd></div>
          <div><dt>Qeydiyyat</dt><dd>{realJoinDate}</dd></div>
          {profile?.email && <div><dt>E-poçt</dt><dd className="ud-kv__email">{profile.email}</dd></div>}
        </dl>
        <Button variant="outline" size="sm" block onClick={() => setTab('profile')}>Profilə keç <ChevronRight size={14} /></Button>
      </Card>
    </>
  );

  return (
    <DashboardShell sidebar={sidebar} sidebarLabel="Kabinet" rail={!isAdminUser && tab === 'overview' ? overviewRail : undefined}>

      {/* ═══ OVERVIEW ═══ */}
      {!isAdminUser && tab === 'overview' && (
        <div className="ud-section">
          <div className="page-header">
            <span className="kicker">Xoş gəlmisiniz,</span>
            <h1 className="page-header__title">{realNickname}!</h1>
            <p className="page-header__lead">Bugünkü öyrənmə səyahətinizə davam edin. Kiçik addımlar böyük nəticələr yaradır.</p>
          </div>

          <Card className="ud-hero">
            <span className="avatar avatar--lg avatar--brand" aria-hidden="true">{realNickname.slice(0, 2)}</span>
            <div className="ud-hero__body">
              <div className="ud-hero__top">
                <span className="ud-hero__name">{profile?.firstName} {profile?.lastName}</span>
                <span className="ud-hero__meta">@{realNickname} · {roleBadge(primaryRole).label}</span>
              </div>
              <div className="ud-hero__progress">
                <span className="ud-hero__progress-label">Ümumi irəliləyiş</span>
                <ProgressBar value={overallPct} label="Ümumi irəliləyiş" size="lg" showValue />
              </div>
              <p className="note">Davam edin! Sahə üzrə irəliləyişiniz sual bankının nə qədərini həll etdiyinizi göstərir.</p>
            </div>
          </Card>

          {overviewLoading ? <LoadingState compact text="Göstəricilər yüklənir..." /> : myOverview && summaryStats(myOverview.summary)}

          <Card>
            <CardHead icon={<TrendingUp size={15} />} title="Sahə üzrə irəliləyiş" action={<button type="button" className="card__link" onClick={() => setTab('progress')}>Hamısını gör <ChevronRight size={13} /></button>} />
            {!overviewLoading && categoryProgress.length === 0
              ? <EmptyState compact icon={<Target size={18} />} title="Hələ sual həll etməmisiniz" text="Biliklər bölməsindən ilk quiz-ə başlayın." action={<Button variant="outline" size="sm" onClick={onGoHome}>Biliklərə keç</Button>} />
              : progressRows(categoryProgress.slice(0, 4).map(c => ({ area: c.label, solved: c.solved, total: c.total, percentage: c.pct })))}
          </Card>

          <Card>
            <CardHead icon={<ClipboardList size={15} />} title="Son imtahan sessiyaları" action={<button type="button" className="card__link" onClick={() => setTab('sessions')}>Hamısını gör <ChevronRight size={13} /></button>} />
            {!overviewLoading && recentSessions.length === 0 ? (
              <EmptyState compact icon={<ClipboardList size={18} />} title="Hələ imtahan keçirməmisiniz" text="İlk testi həll edin — nəticələr burada görünəcək." />
            ) : (
              <div className="list">
                {recentSessions.slice(0, 3).map(s => (
                  <div key={s.id} className="list__row">
                    <span className="list__main">
                      <span className="list__title">{s.title}</span>
                      <span className="list__meta"><Clock size={11} /> {s.questionCount} sual · {s.date}</span>
                    </span>
                    <span className="list__end"><strong className="text-1">{s.score}/{s.total}</strong><Badge tone={scoreTone(s.percentage)}>{s.percentage}%</Badge></span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ PROGRESS ═══ */}
      {!isAdminUser && tab === 'progress' && (
        <div className="ud-section">
          <div className="page-header">
            <span className="kicker">İrəliləyiş</span>
            <h1 className="page-header__title">Sahə üzrə irəliləyiş</h1>
            <p className="page-header__lead">Hər kateqoriyada nə qədər irəlilədiniz və son fəallığınız.</p>
          </div>

          {overviewLoading && <LoadingState compact text="Yüklənir..." />}
          {!overviewLoading && categoryProgress.length === 0 && (
            <Card><EmptyState icon={<Target size={20} />} title="Hələ heç bir sual həll etməmisiniz" text="Quiz bölməsindən başlayın — irəliləyiş burada görünəcək." action={<Button variant="primary" onClick={onGoHome}>Biliklərə keç</Button>} /></Card>
          )}

          <div className="ud-progress-cards">
            {categoryProgress.map(cat => (
              <Card key={cat.id} className="ud-prog-card">
                <div className="ud-prog-card__top">
                  <span className="ud-prog-icon" aria-hidden="true"><Layers size={16} /></span>
                  <div className="ud-prog-card__text">
                    <span className="ud-prog-card__label">{cat.label}</span>
                    <span className="ud-prog-card__meta"><Calendar size={11} /> Son fəallıq: {cat.lastActive}</span>
                  </div>
                  <span className="ud-prog-card__pct">{cat.pct}%</span>
                </div>
                <ProgressBar value={cat.pct} label={`${cat.label}: ${cat.pct}%`} />
                <div className="ud-prog-card__footer">
                  <span>{cat.solved} sual həll edildi</span>
                  <span>{cat.total - cat.solved} sual qalıb</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SESSIONS ═══ */}
      {!isAdminUser && tab === 'sessions' && (
        <div className="ud-section">
          <div className="page-header">
            <span className="kicker">İmtahanlarım</span>
            <h1 className="page-header__title">İmtahan sessiyalarım</h1>
            <p className="page-header__lead">Keçirilən bütün sessiyaların nəticələri.</p>
          </div>
          <Card padded={false}>
            {overviewLoading && <LoadingState compact text="Yüklənir..." />}
            {!overviewLoading && recentSessions.length === 0 && <EmptyState icon={<ClipboardList size={20} />} title="Nəticə yoxdur" text="İmtahan keçirdikdən sonra nəticələr burada görünəcək." />}
            {!overviewLoading && recentSessions.length > 0 && sessionsTable(recentSessions, true)}
          </Card>
        </div>
      )}

      {/* ═══ MY COURSES (VIP) ═══ */}
      {!isAdminUser && tab === 'courses' && (isVip || hasOwnCourses) && (
        <MyCoursesTab onToast={showAdminToast} />
      )}

      {/* ═══ STUDENTS (Teacher) ═══ */}
      {!isAdminUser && tab === 'students' && isTeacher && (
        <div className="ud-section">
          <div className="page-header">
            <span className="kicker">Tələbələr</span>
            <h1 className="page-header__title">Sinif izləmə</h1>
            <p className="page-header__lead">Sinif açın, tələbə ID-si ilə şagird əlavə edin və göstəricilərini izləyin.</p>
          </div>

          <Card>
            <CardHead icon={<School size={15} />} title="Sinif idarəetməsi" />
            <div className="ud-class-forms">
              <form className="ud-inline-form" onSubmit={handleCreateClass}>
                <FormField id="class-name" label="Yeni sinif adı" icon={<School size={13} />}>
                  <input id="class-name" className="input" type="text" placeholder="Məsələn: Kiber təhlükəsizlik 101" value={className} onChange={e => setClassName(e.target.value)} />
                </FormField>
                <Button type="submit" variant="primary" loading={classLoading}><Plus size={15} /> Sinif aç</Button>
              </form>
              <form className="ud-inline-form" onSubmit={handleAddStudentToClass}>
                <FormField id="student-id-search" label="Tələbə ID-si" icon={<User size={13} />}>
                  <input id="student-id-search" className="input input--mono" type="text" placeholder="Məsələn: 7f3c..." value={studentId} onChange={e => setStudentId(e.target.value)} disabled={!selectedClass} />
                </FormField>
                <Button type="submit" variant="primary" loading={studentLoading} disabled={!selectedClass}><UserPlus size={15} /> Əlavə et</Button>
              </form>
            </div>

            <div className="ud-class-list" role="group" aria-label="Siniflər">
              {classLoading && teacherClasses.length === 0 && <span className="field__hint">Siniflər yüklənir...</span>}
              {!classLoading && teacherClasses.length === 0 && <span className="field__hint">Hələ sinif yoxdur. İlk sinfi açaraq tələbələri ora əlavə edin.</span>}
              {teacherClasses.map(item => (
                <button key={item.id} type="button" className="segmented__btn ud-class-chip" aria-pressed={selectedClass?.id === item.id}
                  onClick={() => { setSelectedClassId(item.id); setStudentOverview(null); setStudentError(''); }}>
                  <School size={13} /> {item.name} <span className="ud-class-chip__count">{item.studentCount}</span>
                </button>
              ))}
            </div>

            <p className="field__hint">
              {selectedClass
                ? `"${selectedClass.name}" sinfinə əlavə edilən tələbələr aşağıda izlənəcək.`
                : 'Tələbə əlavə etmək üçün əvvəl sinif seçin.'}
            </p>
            {classMsg && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{classMsg}</span></div>}
            {classError && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{classError}</span></div>}
            {studentError && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{studentError}</span></div>}
          </Card>

          {selectedClass && (
            <Card padded={false}>
              <div className="es-table-head"><h3 className="card__title" style={{ marginBottom: 0 }}><Users size={15} /> {selectedClass.name} · tələbələr</h3><span className="text-3 text-xs">{selectedClass.studentCount} tələbə</span></div>
              {selectedClass.students.length === 0 ? (
                <EmptyState compact icon={<Users size={18} />} title="Bu sinifdə hələ tələbə yoxdur" text="Tələbə ID-si ilə ilk şagirdi əlavə edin." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Tələbə</th><th className="is-num">Ortalama</th><th className="is-num">İmtahan</th><th>İrəliləyiş</th><th className="cell-actions">Baxış</th></tr>
                    </thead>
                    <tbody>
                      {selectedClass.students.map(student => (
                        <tr key={student.id}>
                          <td><span className="cell-main">{student.firstName} {student.lastName}</span><span className="cell-sub">@{student.nickname}</span></td>
                          <td className="is-num"><Badge tone={scoreTone(student.summary.averageScore)}>{student.summary.averageScore}%</Badge></td>
                          <td className="is-num">{student.summary.examsTaken}</td>
                          <td><div className="es-progress-cell"><ProgressBar value={student.summary.overallProgress} label={`${student.nickname}: ${student.summary.overallProgress}%`} size="sm" /><span className="cell-mono">{student.summary.overallProgress}%</span></div></td>
                          <td className="cell-actions"><Button variant="outline" size="sm" onClick={() => handleViewStudent(student.id)} disabled={studentLoading}><Eye size={14} /> Bax</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {studentOverview && (
            <Card className="ud-student-panel">
              <div className="ud-student-head">
                <span className="avatar avatar--lg" aria-hidden="true">{studentOverview.nickname.slice(0, 2)}</span>
                <div className="ud-student-head__text">
                  <h3>{studentOverview.firstName} {studentOverview.lastName}</h3>
                  <span className="text-2 text-sm">@{studentOverview.nickname} · qeydiyyat: {formatDate(studentOverview.joinDate)}</span>
                  <code className="code-inline">{studentOverview.id}</code>
                </div>
                <IconButton label="Paneli bağla" onClick={() => setStudentOverview(null)}><X size={16} /></IconButton>
              </div>
              {summaryStats(studentOverview.summary)}
              <div>
                <h4 className="ud-subtitle">Sahə üzrə göstəricilər</h4>
                {studentOverview.progressAreas.length === 0 ? <p className="note">Hələ fəaliyyət yoxdur.</p> : progressRows(studentOverview.progressAreas)}
              </div>
              <div>
                <h4 className="ud-subtitle">İmtahan sessiyaları</h4>
                {studentOverview.examSessions.length === 0
                  ? <p className="note">Hələ imtahan nəticəsi yoxdur.</p>
                  : sessionsTable(studentOverview.examSessions.map(s => ({ id: s.id, title: s.title, date: formatDate(s.date), score: s.score, total: s.maxScore, percentage: s.percentage, status: s.status })), false)}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ ADMIN BÖLMƏLƏRİ ═══
          Hər biri isAdminUser ilə qapalıdır. Bu yalnız görünüş qatıdır:
          api/admin endpoint-ləri serverdə Admin rolu tələb edir. */}
      {isAdminUser && tab === 'adm-overview' && (
        <div className="ud-section"><DashboardTab stats={adminStats} onRefresh={loadAdminStats} onNavigate={next => setTab(next as Tab)} /></div>
      )}
      {isAdminUser && tab === 'adm-courses' && (
        <div className="ud-section"><CoursesTab onToast={showAdminToast} /></div>
      )}
      {isAdminUser && tab === 'adm-users' && (
        <div className="ud-section"><UsersTab onToast={showAdminToast} /></div>
      )}
      {isAdminUser && tab === 'adm-exams' && (
        <div className="ud-section"><AdminExamsTab onToast={showAdminToast} /></div>
      )}

      {isAdminUser && tab === 'adm-bank' && (
        <div className="ud-section"><AdminBankTab onToast={showAdminToast} /></div>
      )}

      {/* ═══ PROFILE ═══ */}
      {!isAdminUser && tab === 'profile' && (
        <div className="ud-section">
          <div className="page-header">
            <span className="kicker">Profil</span>
            <h1 className="page-header__title">Mənim profilim</h1>
            <p className="page-header__lead">Şəxsi məlumatlarınızı, e-poçt və şifrə təhlükəsizliyini idarə edin.</p>
          </div>

          <div className="ud-profile-grid">
            {/* Şəxsi məlumatlar */}
            <Card className="ud-profile-card">
              <div className="ud-profile-identity">
                <span className="avatar avatar--xl avatar--brand" aria-hidden="true">{realNickname.slice(0, 2)}</span>
                <div className="ud-profile-identity__text">
                  <span className="ud-hero__name">{profile?.firstName} {profile?.lastName}</span>
                  <span className="text-2 text-sm">@{realNickname}</span>
                  <div className="ud-roles">{realRoles.map(role => <Badge key={role} tone={roleBadge(role).tone}>{roleBadge(role).label}</Badge>)}</div>
                </div>
              </div>

              <div className="form-grid form-grid--2">
                <FormField id="ud-first" label="Ad" icon={<User size={13} />}>
                  <input id="ud-first" className="input" type="text" value={form.firstName} disabled={!editMode} onChange={e => set('firstName', e.target.value)} />
                </FormField>
                <FormField id="ud-last" label="Soyad" icon={<User size={13} />}>
                  <input id="ud-last" className="input" type="text" value={form.lastName} disabled={!editMode} onChange={e => set('lastName', e.target.value)} />
                </FormField>
              </div>
              <FormField id="ud-nickname" label="Ləqəb (nickname)" icon={<User size={13} />} hint="Liderlik lövhəsində yalnız bu ad görünür.">
                <input id="ud-nickname" className="input" type="text" value={form.nickname} disabled={!editMode} onChange={e => set('nickname', e.target.value)} />
              </FormField>
              <div className="field">
                <span className="field__label" id="ud-gender-label"><User size={13} /> Cins</span>
                <div className="ud-radios" role="radiogroup" aria-labelledby="ud-gender-label">
                  {[['Kişi', 'male'], ['Qadın', 'female']].map(([label, val]) => (
                    <label key={val} className="choice">
                      <input type="radio" name="ud-gender" value={val} disabled={!editMode} checked={form.gender === val} onChange={() => set('gender', val)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {profile?.id && (
                <FormField id="ud-user-id" label={isTeacher ? 'Müəllim ID-si' : 'İstifadəçi ID-si'} icon={<KeyRound size={13} />}
                  hint={isTeacher ? 'Bu, sizin müəllim hesabınızın unikal identifikatorudur.' : 'Bu ID-ni müəlliminizlə paylaşaraq göstəricilərinizin izlənməsinə icazə verə bilərsiniz.'}>
                  <div className="input-wrap">
                    <input id="ud-user-id" className="input input--mono" type="text" value={profile.id} disabled readOnly />
                    <button type="button" className="input-wrap__action" onClick={handleCopyUserId} aria-label="ID-ni kopyala" title="ID-ni kopyala">
                      {userIdCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </FormField>
              )}

              {saveMsg && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{saveMsg}</span></div>}
              {saveError && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{saveError}</span></div>}

              <div className="ud-profile-actions">
                {editMode ? (
                  <>
                    <Button variant="primary" onClick={handleSave} loading={saving}><Save size={15} /> Yadda saxla</Button>
                    <Button variant="outline" onClick={() => {
                      setForm({
                        firstName: profile?.firstName ?? '',
                        lastName: profile?.lastName ?? '',
                        nickname: profile?.nickname ?? '',
                        gender: genderLabel(profile?.gender),
                      });
                      setEditMode(false);
                      setSaveError('');
                    }}>Ləğv et</Button>
                  </>
                ) : (
                  <Button variant="primary" onClick={() => setEditMode(true)}><Edit3 size={15} /> Məlumatları redaktə et</Button>
                )}
              </div>
              <p className="text-3 text-xs"><Calendar size={11} /> Qeydiyyat tarixi: {realJoinDate} · Aktiv hesab</p>
            </Card>

            <div className="ud-profile-side">
              {/* E-poçt və şifrə */}
              <Card>
                <CardHead icon={<Lock size={15} />} title="E-poçt və təhlükəsizlik" />
                <div className="ud-security">
                  {profile?.email && (
                    <FormField id="ud-email" label="Cari e-poçt" icon={<Mail size={13} />}>
                      <input id="ud-email" className="input" type="email" value={profile.email} disabled readOnly />
                    </FormField>
                  )}
                  <FormField id="ud-new-email" label="Yeni e-poçt" icon={<Mail size={13} />} hint="Dəyişiklik əvvəl cari ünvandan təsdiqlənir, sonra yeni ünvana gələn linklə aktivləşir.">
                    <div className="ud-inline-row">
                      <input id="ud-new-email" className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="yeni-email@gmail.com" />
                      <Button variant="outline" onClick={handleEmailChange} disabled={securityLoading || !newEmail.trim()}>Təsdiq linki göndər</Button>
                    </div>
                  </FormField>
                  <div className="field">
                    <span className="field__label"><Lock size={13} /> Şifrə</span>
                    <Button variant="outline" onClick={handlePasswordChange} disabled={securityLoading}>Şifrə yeniləmə linki göndər</Button>
                    <span className="field__hint">Link təsdiqli e-poçt ünvanına göndərilir və yeni şifrə link üzərindən yazılır.</span>
                  </div>
                  {securityMsg && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{securityMsg}</span></div>}
                  {securityError && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{securityError}</span></div>}
                </div>
              </Card>

              {/* ── Hesab tipi (rol keçidi) ─────────────────────────────
                  Yalnız İstifadəçi ⇄ Müəllim. Server admin hesabını rədd etdiyi üçün
                  bu kart admin kabinetində ümumiyyətlə render olunmur. */}
              {isVip ? (
                <Card>
                  <CardHead icon={<Crown size={15} />} title="Hesab tipi" action={<Badge tone="warning">VIP</Badge>} />
                  {/* VIP rolu ödənişli dövrə bağlıdır — server kabinetdən rol keçidini rədd edir, ona görə düymə də yoxdur. */}
                  <p className="note">VIP hesabın rolu kabinetdən dəyişdirilmir: üzvlük dövrü, təlim paylaşma hüququ və imtahan sessiyaları bu rola bağlıdır. Dəyişiklik üçün administratora müraciət edin.</p>
                </Card>
              ) : (
              <Card>
                <CardHead icon={<ArrowLeftRight size={15} />} title="Hesab tipi" action={<Badge tone={currentRole === 'Teacher' ? 'success' : 'neutral'}>{ROLE_LABELS[currentRole]}</Badge>} />
                <div className="ud-role">
                  <p className="note">
                    {currentRole === 'User'
                      ? 'Müəllim hesabına keçsəniz sinif yarada və tələbələrinizin göstəricilərini izləyə bilərsiniz.'
                      : 'Tələbə hesabına qayıtsanız sinif idarəetməsi bağlanır, öz nəticələriniz isə olduğu kimi qalır.'}
                  </p>

                  {/* Siniflər yüklənməyibsə susmuruq: əks halda keçid mümkün görünür,
                      server isə rədd edir və istifadəçi səbəbi anlamır. */}
                  {currentRole === 'Teacher' && classError && (
                    <div className="notice notice--warning" role="alert"><AlertTriangle size={16} /><span>Sinif siyahısı yüklənmədi ({classError}) — keçid serverdə yoxlanacaq.</span></div>
                  )}

                  {roleSwitchBlocked ? (
                    <div className="ud-role-gate">
                      <div className="notice notice--warning" role="status">
                        <AlertTriangle size={16} />
                        <span>Tələbə roluna keçmək üçün əvvəlcə bütün sinifləri silin ({blockingClasses.length}).</span>
                      </div>
                      <ul className="list ud-role-classes">
                        {blockingClasses.map(item => (
                          <li key={item.id} className="list__row">
                            <span className="list__main">
                              <span className="list__title"><School size={13} /> {item.name}</span>
                              <span className="list__meta">{item.studentCount} tələbə</span>
                            </span>
                            <Button variant="danger" size="sm" onClick={() => setClassPendingDelete(item)} disabled={deletingClassId !== null} loading={deletingClassId === item.id}>
                              <Trash2 size={14} /> Sil
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <span className="field__hint">Sinif silindikdə yalnız sinfə bağlılıq itir — tələbə hesabları və onların nəticələri silinmir.</span>
                    </div>
                  ) : roleConfirm ? (
                    <div className="ud-role-confirm">
                      <div className="notice notice--warning" role="alert"><AlertTriangle size={16} /><span>Rol dəyişdikdən sonra sessiya bağlanır və yenidən daxil olmalısınız.</span></div>
                      <div className="ud-profile-actions">
                        <Button variant="primary" onClick={handleChangeRole} loading={roleSwitching}>Bəli, {ROLE_LABELS[targetRole]} et</Button>
                        <Button variant="outline" onClick={() => { setRoleConfirm(false); setRoleError(''); }} disabled={roleSwitching}>Ləğv et</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="ud-profile-actions">
                      <Button variant="secondary" onClick={() => { setRoleConfirm(true); setRoleError(''); setRoleMsg(''); }} disabled={roleSwitching}>
                        <ArrowLeftRight size={15} /> {ROLE_LABELS[targetRole]} roluna keç
                      </Button>
                    </div>
                  )}

                  {roleMsg && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{roleMsg}</span></div>}
                  {roleError && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{roleError}</span></div>}
                </div>
              </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sinif silmə təsdiqi — geri qaytarıla bilməyən əməliyyat üçün açıq razılıq. */}
      <ConfirmDialog
        open={classPendingDelete !== null}
        title="Sinfi silmək istədiyinizə əminsiniz?"
        confirmLabel="Bəli, sil"
        icon={<Trash2 size={14} />}
        busy={deletingClassId !== null}
        onCancel={() => { if (deletingClassId === null) setClassPendingDelete(null); }}
        onConfirm={() => { if (classPendingDelete) void handleDeleteClass(classPendingDelete.id); }}
      >
        {classPendingDelete && (
          <>
            <strong>«{classPendingDelete.name}»</strong> sinfi silinəcək
            {classPendingDelete.studentCount > 0
              ? <> və {classPendingDelete.studentCount} tələbənin bu sinfə bağlılığı itəcək.</>
              : <>.</>}
            {' '}Tələbə hesabları və onların nəticələri silinmir. Bu əməliyyat geri qaytarıla bilməz.
          </>
        )}
      </ConfirmDialog>

      {adminToast && (
        <Toast
          message={adminToast.msg}
          type={adminToast.type}
          onDone={() => setAdminToast(null)}
        />
      )}
    </DashboardShell>
  );
}
