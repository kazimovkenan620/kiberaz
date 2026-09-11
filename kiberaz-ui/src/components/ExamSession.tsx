import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ClipboardList, Clock, Copy, FileText, LogIn, Plus, RefreshCw, Shield, Users, X } from 'lucide-react';
import { getStoredUserRoles, getToken } from '../services/authService';
import {
  closeExamSession, createExamSession, getExamAttempt, getExamCategories, getExamDashboard,
  getExamOverview, joinExamSession, saveExamAnswer, submitExamAttempt,
  type ExamAttempt, type ExamCategory, type ExamDashboard, type ExamOverview, type ExamSessionInfo,
} from '../services/examSessionService';
import './ExamSession.css';

const errorText = (result: { message: string; errors?: string[] }) => result.errors?.[0] || result.message;
const formatDate = (value: string) => new Intl.DateTimeFormat('az-AZ', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

function CreateSessionModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (session: ExamSessionInfo) => void;
}) {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(45);
  const [created, setCreated] = useState<ExamSessionInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getExamCategories().then(result => {
      if (!active) return;
      if (result.success && result.data) setCategories(result.data.filter(c => c.questionCount > 0));
      else setError(errorText(result));
      setLoading(false);
    }).catch(() => { if (active) { setError('Serverlə əlaqə yaradıla bilmədi.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const changeCount = (category: ExamCategory, delta: number) => setCounts(current => ({
    ...current,
    [category.id]: Math.max(0, Math.min(category.questionCount, (current[category.id] ?? 0) + delta)),
  }));

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || total < 1 || total > 50) return;
    setLoading(true); setError('');
    try {
      const result = await createExamSession({
        title: title.trim(), durationMinutes: duration,
        categories: Object.entries(counts).filter(([, count]) => count > 0)
          .map(([categoryId, count]) => ({ categoryId: Number(categoryId), count })),
      });
      if (result.success && result.data) { setCreated(result.data); onCreated(result.data); }
      else setError(errorText(result));
    } catch { setError('Serverlə əlaqə yaradıla bilmədi.'); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.code);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };

  return <div className="es-backdrop" role="dialog" aria-modal="true" aria-labelledby="es-create-title">
    <div className="es-modal">
      <div className="es-modal-head"><div><span className="es-kicker">İMTAHAN SİSTEMİ</span><h3 id="es-create-title">Sessiya yarat</h3></div><button className="es-icon-btn" onClick={onClose} aria-label="Bağla"><X size={18} /></button></div>
      {created ? <div className="es-success"><span className="es-success-mark"><Check size={26} /></span><h4>Sessiya hazırdır</h4><p>Tələbələr bu kodla imtahana qoşula bilər.</p><button className="es-code es-code-button" onClick={() => void copy()}>{created.code} {copied ? <Check size={16} /> : <Copy size={16} />}</button><button className="btn btn-primary" onClick={onClose}>Panelə keç</button></div> :
        <form className="es-form" onSubmit={create}>
          <label>Sessiyanın adı<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required placeholder="Web Security yekun imtahanı" /></label>
          <fieldset><legend>Müddət</legend><div className="es-choice-row">{[15, 30, 45, 60, 90, 120].map(value => <button key={value} type="button" className={duration === value ? 'active' : ''} onClick={() => setDuration(value)}>{value} dəq</button>)}</div></fieldset>
          <fieldset><legend>Kateqoriyalar və sual sayı</legend>{loading && <p className="es-muted">Kateqoriyalar yüklənir...</p>}<div className="es-category-list">{categories.map(category => <div className="es-category" key={category.id}><span><strong>{category.title}</strong><small>{category.questionCount} sual mövcuddur</small></span><span className="es-counter"><button type="button" onClick={() => changeCount(category, -1)} aria-label={`${category.title} azalt`}>−</button><b>{counts[category.id] ?? 0}</b><button type="button" onClick={() => changeCount(category, 1)} aria-label={`${category.title} artır`}>+</button></span></div>)}</div></fieldset>
          <div className="es-form-summary"><span>{total} sual</span><span>{duration} dəqiqə</span><span>{total ? Math.floor(duration * 60 / total) : 0} san/sual</span></div>
          {total > 50 && <p className="es-error">Bir sessiyada maksimum 50 sual seçilə bilər.</p>}{error && <p className="es-error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={loading || !title.trim() || total < 1 || total > 50}><Plus size={16} />{loading ? 'Gözləyin...' : 'Sessiyanı yarat'}</button>
        </form>}
    </div>
  </div>;
}

function ExamPlayer({ initial, onExit }: { initial: ExamAttempt; onExit: () => void }) {
  const [attempt, setAttempt] = useState(initial);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current || attempt.submittedAt) return;
    submitting.current = true; setSaving(true); setError('');
    try { const result = await submitExamAttempt(attempt.id); if (result.success && result.data) setAttempt(result.data); else setError(errorText(result)); }
    catch { setError('Nəticə serverə göndərilə bilmədi.'); }
    finally { submitting.current = false; setSaving(false); }
  };

  useEffect(() => {
    const serverOffset = new Date(attempt.serverNow).getTime() - Date.now();
    const tick = () => {
      const value = Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - (Date.now() + serverOffset)) / 1000));
      setRemaining(value);
      if (value === 0 && !attempt.submittedAt) void submit();
    };
    const timer = window.setInterval(tick, 1000);
    void Promise.resolve().then(tick);
    return () => window.clearInterval(timer);
  });

  const choose = async (questionId: string, optionKey: string) => {
    if (saving || attempt.submittedAt) return;
    setSaving(true); setError('');
    try {
      const result = await saveExamAnswer(attempt.id, questionId, optionKey, attempt.revision);
      if (result.success && result.data) setAttempt(result.data);
      else { setError(errorText(result)); const fresh = await getExamAttempt(attempt.id); if (fresh.success && fresh.data) setAttempt(fresh.data); }
    } catch { setError('Cavab saxlanmadı. İnternet bağlantısını yoxlayın.'); }
    finally { setSaving(false); }
  };

  if (attempt.submittedAt) return <div className="es-player es-result"><span className="es-success-mark"><Check size={28} /></span><span className="es-kicker">İMTAHAN TAMAMLANDI</span><h3>{attempt.session.title}</h3><div className="es-score">{attempt.percentage ?? 0}%</div><p>{attempt.correctCount} / {attempt.questions.length} düzgün cavab</p><button className="btn btn-primary" onClick={onExit}>Sessiyalara qayıt</button></div>;

  const question = attempt.questions[index];
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  return <div className="es-player">
    <div className="es-player-head"><div><span className="es-kicker">{question.category}</span><h3>{attempt.session.title}</h3></div><div className="es-timer"><Clock size={17} />{minutes}:{seconds}</div></div>
    <div className="es-progress"><span style={{ width: `${((index + 1) / attempt.questions.length) * 100}%` }} /></div>
    <div className="es-question-meta"><span>Sual {index + 1} / {attempt.questions.length}</span><span>{Object.keys(attempt.answers).length} cavablandı</span></div>
    <h4 className="es-question-text">{question.text}</h4>
    <div className="es-options">{question.options.map(option => <button key={option.key} className={attempt.answers[question.id] === option.key ? 'selected' : ''} onClick={() => void choose(question.id, option.key)} disabled={saving}><b>{option.key}</b><span>{option.text}</span>{attempt.answers[question.id] === option.key && <Check size={17} />}</button>)}</div>
    {error && <p className="es-error" role="alert">{error}</p>}
    <div className="es-player-actions"><button className="btn btn-secondary" onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}><ChevronLeft size={16} />Əvvəlki</button>{index < attempt.questions.length - 1 ? <button className="btn btn-primary" onClick={() => setIndex(value => value + 1)}>Növbəti<ChevronRight size={16} /></button> : <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Göndərilir...' : 'İmtahanı bitir'}</button>}</div>
  </div>;
}

function TeacherDashboard({ code, onBack, onClosed }: { code: string; onBack: () => void; onClosed: () => void }) {
  const [dashboard, setDashboard] = useState<ExamDashboard | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const load = useCallback(async () => { try { const result = await getExamDashboard(code); if (result.success && result.data) { setDashboard(result.data); setError(''); } else setError(errorText(result)); } catch { setError('Panel yenilənmədi.'); } }, [code]);
  useEffect(() => { const timer = window.setInterval(() => void load(), 10000); void Promise.resolve().then(load); return () => window.clearInterval(timer); }, [load]);
  const close = async () => { const result = await closeExamSession(code); if (result.success) { await load(); onClosed(); } else setError(errorText(result)); };
  if (!dashboard) return <div className="es-player es-loading"><p>{error || 'Panel yüklənir...'}</p><button className="btn btn-secondary" onClick={onBack}>Geri</button></div>;
  const completed = dashboard.participants.filter(p => p.submittedAt).length;
  return <div className="es-player">
    <div className="es-player-head"><div><span className="es-kicker">MÜƏLLİM PANELİ</span><h3>{dashboard.session.title}</h3></div><button className="es-code es-code-button" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{code}{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>
    <div className="es-stat-grid"><div><Users size={18} /><strong>{dashboard.participants.length}</strong><span>İştirakçı</span></div><div><Check size={18} /><strong>{completed}</strong><span>Tamamlayan</span></div><div><FileText size={18} /><strong>{dashboard.session.questionCount}</strong><span>Sual</span></div></div>
    <div className="es-table"><div className="es-table-row es-table-head"><span>Tələbə</span><span>İrəliləyiş</span><span>Nəticə</span></div>{dashboard.participants.length === 0 ? <p className="es-empty">Hələ heç kim qoşulmayıb.</p> : dashboard.participants.map(p => <div className="es-table-row" key={p.id}><span>{p.name}</span><span>{p.answeredCount}/{dashboard.session.questionCount}</span><span>{p.submittedAt ? `${p.percentage ?? 0}%` : 'Davam edir'}</span></div>)}</div>
    {error && <p className="es-error">{error}</p>}
    <div className="es-player-actions"><button className="btn btn-secondary" onClick={onBack}>Geri</button><button className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={15} />Yenilə</button>{!dashboard.session.isClosed && <button className="btn btn-primary" onClick={() => void close()}>Sessiyanı bağla</button>}</div>
  </div>;
}

export default function ExamSession() {
  const loggedIn = Boolean(getToken());
  const roles = getStoredUserRoles().map(role => role.toLowerCase());
  const admin = roles.includes('admin');
  const teacher = !admin && roles.includes('teacher');
  const [overview, setOverview] = useState<ExamOverview | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [dashboardCode, setDashboardCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadOverview = useCallback(async () => { if (!getToken() || admin) { setOverview(null); return; } try { const result = await getExamOverview(); if (result.success && result.data) setOverview(result.data); } catch { /* action errors are shown separately */ } }, [admin]);
  useEffect(() => { if (loggedIn && !admin) void Promise.resolve().then(loadOverview); }, [loggedIn, admin, loadOverview]);
  const join = async (event: React.FormEvent) => { event.preventDefault(); if (!code.trim()) return; setLoading(true); setError(''); try { const result = await joinExamSession(code); if (result.success && result.data) setAttempt(result.data); else setError(errorText(result)); } catch { setError('Serverlə əlaqə yaradıla bilmədi.'); } finally { setLoading(false); } };
  const resume = async (id: string) => { setLoading(true); setError(''); try { const result = await getExamAttempt(id); if (result.success && result.data) setAttempt(result.data); else setError(errorText(result)); } catch { setError('İmtahan yüklənmədi.'); } finally { setLoading(false); } };

  if (attempt) return <section id="exam-session" className="exam-section"><div className="container"><ExamPlayer initial={attempt} onExit={() => { setAttempt(null); void loadOverview(); }} /></div></section>;
  if (dashboardCode) return <section id="exam-session" className="exam-section"><div className="container"><TeacherDashboard code={dashboardCode} onBack={() => setDashboardCode(null)} onClosed={() => void loadOverview()} /></div></section>;
  const recentSession = overview?.sessions[0];
  return <>
    <section id="exam-session" className="exam-section" aria-labelledby="exam-section-title"><div className="container">
      <div className="section-header"><div className="section-tag"><ClipboardList size={14} />İmtahan Sistemi</div><h2 className="section-title" id="exam-section-title">İmtahan <span className="gradient-text">sessiyaları</span></h2><p className="section-description">Müəllim real sual bankından sessiya yaradır, tələbə kodla qoşulur və nəticə avtomatik hesablanır.</p></div>
      {!loggedIn && <div className="es-auth-note"><LogIn size={20} /><div><strong>İmtahan sistemi üçün hesaba daxil olun</strong><p>Sessiya yaratmaq, qoşulmaq və nəticələri saxlamaq üçün giriş tələb olunur.</p></div></div>}
      {loggedIn && admin && <div className="es-auth-note"><Shield size={20} /><div><strong>Admin hesabı üçün imtahan fəaliyyəti bağlıdır</strong><p>İdarəetmə əməliyyatlarını kabinetdəki Admin Panel bölməsindən aparın.</p></div></div>}
      <div className="exam-layout"><div className="exam-left">
        <div className="exam-action-card"><div className="es-action-title"><Plus size={20} /><strong>Sessiya yarat</strong></div><p className="exam-action-desc">Mövcud kateqoriyalardan sual seçin, vaxt təyin edin və unikal kodu tələbələrlə paylaşın.</p><button className="btn btn-primary" disabled={!loggedIn || !teacher} onClick={() => setShowCreate(true)}><Plus size={16} />Sessiya yarat</button>{loggedIn && !teacher && !admin && <small className="es-hint">Bu funksiya müəllim hesabları üçündür.</small>}</div>
        <div className="exam-action-card"><div className="es-action-title"><LogIn size={20} /><strong>Sessiyaya qoşul</strong></div><p className="exam-action-desc">Müəllimdən aldığınız KBR-XXXXXXXXXXXXXXXX kodunu daxil edin.</p><form className="exam-join-form" onSubmit={join}><input className="exam-join-input" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9-]/g, ''))} placeholder="KBR-1234567890ABCDEF" maxLength={20} disabled={!loggedIn || admin || loading} aria-label="Sessiya kodu" /><button className="btn btn-success" disabled={!loggedIn || admin || loading}><LogIn size={16} />{loading ? 'Yoxlanır...' : 'Qoşul'}</button></form>{error && <p className="es-error" role="alert">{error}</p>}</div>
      </div><div className="exam-right">
        {teacher && recentSession && <div className="exam-dashboard-card"><div className="exam-dashboard-header"><strong>Son sessiyanız</strong><span>{recentSession.isClosed ? 'Bağlı' : 'Aktiv'}</span></div><div className="exam-dashboard-body"><div className="exam-session-code"><div><small>Sessiya kodu</small><div className="exam-session-code-value">{recentSession.code}</div></div><button className="es-icon-btn" onClick={() => void navigator.clipboard.writeText(recentSession.code)} aria-label="Kodu kopyala"><Copy size={15} /></button></div><div className="exam-dashboard-stats"><div><strong>{recentSession.questionCount}</strong><small>Sual</small></div><div><strong>{recentSession.durationMinutes}</strong><small>Dəqiqə</small></div></div><button className="btn btn-primary" onClick={() => setDashboardCode(recentSession.code)}>Canlı paneli aç</button></div></div>}
        {!admin && <div><h3 className="es-list-title">{teacher ? 'Sessiyalarım' : 'İmtahan tarixçəm'}</h3><div className="exam-sessions-list">{teacher ? overview?.sessions.map(session => <button className="exam-session-item" key={session.id} onClick={() => setDashboardCode(session.code)}><span className={session.isClosed ? 'status-finished' : 'status-active'}>{session.isClosed ? 'Bağlı' : 'Aktiv'}</span><span className="exam-session-info"><strong>{session.title}</strong><small>{session.questionCount} sual · {session.durationMinutes} dəq · {formatDate(session.createdAt)}</small></span><ChevronRight size={16} /></button>) : overview?.attempts.map(item => <button className="exam-session-item" key={item.id} onClick={() => void resume(item.id)}><span className={item.submittedAt ? 'status-finished' : 'status-active'}>{item.submittedAt ? `${item.percentage ?? 0}%` : 'Davam edir'}</span><span className="exam-session-info"><strong>{item.session.title}</strong><small>{item.session.teacherName} · {item.session.questionCount} sual</small></span><ChevronRight size={16} /></button>)}{loggedIn && ((teacher && !overview?.sessions.length) || (!teacher && !overview?.attempts.length)) && <p className="es-empty">Hələ heç bir qeyd yoxdur.</p>}</div></div>}
      </div></div>
    </div></section>
    {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} onCreated={() => void loadOverview()} />}
  </>;
}
