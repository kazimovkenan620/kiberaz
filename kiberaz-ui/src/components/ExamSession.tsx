import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, ClipboardList, Clock, Copy, Crown, FileText,
  Flag, LogIn, Minus, Plus, RefreshCw, Shield, Users, XCircle, KeyRound, ListChecks, Lock,
} from 'lucide-react';
import { getStoredUserRoles, getToken } from '../services/authService';
import {
  closeExamSession, createExamSession, getExamAttempt, getExamCategories, getExamDashboard,
  getExamOverview, joinExamSession, saveExamAnswer, submitExamAttempt,
  type ExamAttempt, type ExamCategory, type ExamDashboard, type ExamOverview, type ExamQuota, type ExamSessionInfo,
} from '../services/examSessionService';
import { requestAuth } from '../utils/authUi';
import { Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, FormField, IconButton, LoadingState, Modal, ProgressBar, StatCard } from './ui';
import './ExamSession.css';

// ─── İmtahan sessiyaları ──────────────────────────────────────
// Vaxt: server `serverNow`/`expiresAt` verir; client yalnız fərqi göstərir və
// vaxt bitəndə serverə submit göndərir. Nəticə yalnız serverdən gəlir.
// Rol: sessiya yaratmaq/panel/bağlama yalnız VIP hesablar üçündür — buradakı rol
// yoxlaması yalnız təqdimat üçündür (düymə/izah), həqiqi icazə server tərəfindədir
// ([Authorize(Roles = VIP)] + servisdəki bazaya əsaslanan yoxlama).
// Günlük limit: hər VIP gündə ən çox 7 sessiya yaradır; sayğac `overview.quota`
// ilə serverdən gəlir, limit dolduqda server 429 qaytarır və UI həmin mesajı göstərir.

const errorText = (result: { message: string; errors?: string[] }) => result.errors?.[0] || result.message;
const formatDate = (value: string) => new Intl.DateTimeFormat('az-AZ', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat('az-AZ', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

// Günlük kvota göstəricisi: "bu gün 3 / 7", qalan say və yenilənmə vaxtı (server UTC 00:00 → lokal saat).
function QuotaMeter({ quota }: { quota: ExamQuota }) {
  const exhausted = quota.remaining <= 0;
  return (
    <div className={`es-quota${exhausted ? ' es-quota--exhausted' : ''}`} role="status" aria-live="polite">
      <div className="es-quota__row">
        <span className="es-quota__label"><Crown size={14} /> Günlük limit</span>
        <span className="es-quota__value"><strong>{quota.usedToday}</strong> / {quota.dailyLimit} sessiya</span>
      </div>
      <ProgressBar value={quota.dailyLimit ? (quota.usedToday / quota.dailyLimit) * 100 : 0} label={`Bu gün ${quota.usedToday} / ${quota.dailyLimit} sessiya yaradılıb`} size="sm" tone={exhausted ? 'warning' : 'brand'} />
      <span className="es-quota__hint">
        {exhausted
          ? `Bu günün limiti dolub — sayğac ${formatTime(quota.resetsAt)}-da yenilənir.`
          : `Bu gün daha ${quota.remaining} sessiya yarada bilərsiniz · yenilənmə ${formatTime(quota.resetsAt)}`}
      </span>
    </div>
  );
}

// Sessiya kodu: kopyalama düyməsi ilə (kod məxfi deyil — tələbələrə paylaşılır).
function SessionCode({ code, compact }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard icazəsi yoxdursa kod onsuz da görünür */ }
  };
  return (
    <button type="button" className={`es-code${compact ? ' es-code--compact' : ''}`} onClick={() => void copy()} aria-label={`Sessiya kodu ${code}, kopyalamaq üçün klikləyin`}>
      <span className="es-code__value">{code}</span>
      <span className="es-code__icon">{copied ? <Check size={15} /> : <Copy size={15} />}</span>
      <span className="es-code__hint">{copied ? 'Kopyalandı' : 'Kopyala'}</span>
    </button>
  );
}

function CreateSessionModal({ quota, onClose, onCreated }: {
  quota: ExamQuota | null; onClose: () => void; onCreated: (session: ExamSessionInfo) => void;
}) {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(45);
  const [created, setCreated] = useState<ExamSessionInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  return (
    <Modal open onClose={onClose} title="Sessiya yarat" kicker="İmtahan sistemi" size="md">
      {created ? (
        <div className="auth-success">
          <div className="auth-success__icon"><Check size={26} /></div>
          <h3>Sessiya hazırdır</h3>
          <p>Tələbələr bu kodla imtahana qoşula bilər.</p>
          <SessionCode code={created.code} />
          <Button variant="primary" onClick={onClose}>Panelə keç</Button>
        </div>
      ) : (
        <form className="es-form" onSubmit={create}>
          <FormField id="es-title" label="Sessiyanın adı" required>
            <input id="es-title" className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required placeholder="Web Security yekun imtahanı" />
          </FormField>

          <fieldset className="es-fieldset">
            <legend className="field__label">Müddət</legend>
            <div className="segmented" role="group" aria-label="Müddət">
              {[15, 30, 45, 60, 90, 120].map(value => (
                <button key={value} type="button" className="segmented__btn" aria-pressed={duration === value} onClick={() => setDuration(value)}>{value} dəq</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="es-fieldset">
            <legend className="field__label">Kateqoriyalar və sual sayı</legend>
            {loading && categories.length === 0 && <LoadingState text="Kateqoriyalar yüklənir..." compact />}
            <div className="es-category-list">
              {categories.map(category => {
                const value = counts[category.id] ?? 0;
                return (
                  <div className="es-category" key={category.id}>
                    <div className="es-category__info">
                      <strong>{category.title}</strong>
                      <small>{category.questionCount} sual mövcuddur</small>
                    </div>
                    <div className="es-counter" role="group" aria-label={`${category.title} sual sayı`}>
                      <IconButton label={`${category.title} azalt`} size="sm" variant="outline" onClick={() => changeCount(category, -1)} disabled={value === 0}><Minus size={14} /></IconButton>
                      <output className="es-counter__value" aria-live="polite">{value}</output>
                      <IconButton label={`${category.title} artır`} size="sm" variant="outline" onClick={() => changeCount(category, 1)} disabled={value >= category.questionCount}><Plus size={14} /></IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="es-summary">
            <span><strong>{total}</strong> sual</span>
            <span><strong>{duration}</strong> dəqiqə</span>
            <span><strong>{total ? Math.floor(duration * 60 / total) : 0}</strong> san/sual</span>
            {quota && <span><strong>{quota.remaining}</strong> / {quota.dailyLimit} bu gün qalıb</span>}
          </div>
          {total > 50 && <div className="notice notice--warning" role="alert"><AlertTriangle size={16} /><span>Bir sessiyada maksimum 50 sual seçilə bilər.</span></div>}
          {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}

          <div className="modal__actions">
            <Button variant="outline" onClick={onClose}>Ləğv et</Button>
            <Button type="submit" variant="primary" loading={loading && categories.length > 0} disabled={loading || !title.trim() || total < 1 || total > 50 || (quota !== null && quota.remaining <= 0)}>
              <Plus size={16} /> Sessiyanı yarat
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ExamPlayer({ initial, onExit }: { initial: ExamAttempt; onExit: () => void }) {
  const [attempt, setAttempt] = useState(initial);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current || attempt.submittedAt) return;
    submitting.current = true; setSaving(true); setError('');
    try { const result = await submitExamAttempt(attempt.id); if (result.success && result.data) setAttempt(result.data); else setError(errorText(result)); }
    catch { setError('Nəticə serverə göndərilə bilmədi.'); }
    finally { submitting.current = false; setSaving(false); setConfirmFinish(false); }
  };

  // Server vaxtı ilə lokal saat arasındakı fərq bir dəfə hesablanır; geri sayım
  // həmin fərqlə aparılır. Vaxt bitəndə cavablar serverə göndərilir.
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

  const totalQ = attempt.questions.length;
  const answeredCount = Object.keys(attempt.answers).length;

  if (attempt.submittedAt) {
    const pct = attempt.percentage ?? 0;
    return (
      <Card className="es-result">
        <div className="es-result__icon"><Check size={26} /></div>
        <span className="kicker">İmtahan tamamlandı</span>
        <h2>{attempt.session.title}</h2>
        <div className="es-result__score">{pct}%</div>
        <p className="text-2">{attempt.correctCount ?? 0} / {totalQ} düzgün cavab</p>
        <ProgressBar value={pct} label="İmtahan nəticəsi" size="lg" tone={pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'brand'} />
        <Button variant="primary" onClick={onExit}><ArrowLeft size={15} /> Sessiyalara qayıt</Button>
      </Card>
    );
  }

  const question = attempt.questions[index];
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  const urgent = remaining > 0 && remaining <= 60;
  const isLast = index >= totalQ - 1;

  return (
    <div className="es-player">
      <div className="es-player__head">
        <div className="es-player__title">
          <span className="kicker">İmtahan{attempt.session.teacherName ? ` · ${attempt.session.teacherName}` : ''}</span>
          <h2>{attempt.session.title}</h2>
          <span className="text-3 text-sm">{totalQ} sual · {attempt.session.durationMinutes} dəq</span>
        </div>
        <div className={`es-timer${urgent ? ' es-timer--urgent' : ''}`} role="timer" aria-live={urgent ? 'assertive' : 'off'} aria-label={`Qalan vaxt ${minutes}:${seconds}`}>
          <Clock size={18} />
          <span className="es-timer__value">{minutes}:{seconds}</span>
          <span className="es-timer__label">Qalan vaxt</span>
        </div>
      </div>

      <div className="es-player__grid">
        <Card className="es-question">
          <div className="es-question__meta">
            <Badge tone="brand" dot>{question.category}</Badge>
            <span className="text-3 text-sm">Sual <strong className="text-1">{index + 1}</strong> / {totalQ}</span>
          </div>
          <ProgressBar value={((index + 1) / totalQ) * 100} label={`Sual ${index + 1} / ${totalQ}`} size="sm" />
          <p className="es-question__text">{question.text}</p>

          <div className="es-options" role="group" aria-label="Cavab variantları">
            {question.options.map(option => {
              const chosen = attempt.answers[question.id] === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`es-option${chosen ? ' is-selected' : ''}`}
                  aria-pressed={chosen}
                  onClick={() => void choose(question.id, option.key)}
                  disabled={saving}
                >
                  <span className="es-option__key" aria-hidden="true">{option.key}</span>
                  <span className="es-option__text">{option.text}</span>
                  {chosen && <Check size={17} className="es-option__check" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}

          <div className="es-player__actions">
            <Button variant="outline" onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}><ChevronLeft size={16} /> Əvvəlki</Button>
            <div className="es-player__actions-right">
              {saving && <span className="inline-status" role="status"><span className="spinner spinner--sm" /> Saxlanılır...</span>}
              {!isLast
                ? <Button variant="primary" onClick={() => setIndex(value => value + 1)}>Növbəti <ChevronRight size={16} /></Button>
                : <Button variant="primary" onClick={() => setConfirmFinish(true)} disabled={saving}><Flag size={15} /> İmtahanı bitir</Button>}
            </div>
          </div>
        </Card>

        <aside className="es-player__rail">
          <Card padded="sm">
            <CardHead icon={<ListChecks size={15} />} title="Sual naviqatoru" />
            <ul className="qnav-legend" aria-hidden="true">
              <li><span className="qnav-legend__dot qnav-legend__dot--answered" /> Cavablanıb</li>
              <li><span className="qnav-legend__dot qnav-legend__dot--current" /> Hazırkı</li>
              <li><span className="qnav-legend__dot" /> Cavablanmayıb</li>
            </ul>
            <div className="qnav-grid" role="group" aria-label="Suallar">
              {attempt.questions.map((q, i) => {
                const answered = attempt.answers[q.id] !== undefined;
                const isCurrent = i === index;
                return (
                  <button key={q.id} type="button"
                    className={`qnav-btn${answered ? ' qnav-btn--answered' : ' qnav-btn--open'}${isCurrent ? ' is-current' : ''}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Sual ${i + 1}${answered ? ', cavablanıb' : ', cavablanmayıb'}`}
                    onClick={() => setIndex(i)}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <p className="es-rail__note"><strong>{answeredCount}</strong> / {totalQ} cavablanıb</p>
          </Card>
          <Card padded="sm" tone="brand">
            <CardHead icon={<Lock size={15} />} title="Qeyd" />
            <p className="note">Cavablar hər seçimdə serverdə saxlanılır. Vaxt bitəndə imtahan avtomatik göndərilir; nəticə yalnız göndərişdən sonra görünür.</p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmFinish}
        title="İmtahanı bitirmək istəyirsiniz?"
        confirmLabel="Bəli, bitir"
        tone="primary"
        icon={<Flag size={15} />}
        busy={saving}
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => void submit()}
      >
        {answeredCount < totalQ
          ? <><strong>{totalQ - answeredCount} sual cavabsızdır.</strong> Göndərildikdən sonra cavablar dəyişdirilə bilməz.</>
          : <>Bütün suallar cavablanıb. Göndərildikdən sonra cavablar dəyişdirilə bilməz.</>}
      </ConfirmDialog>
    </div>
  );
}

function TeacherDashboard({ code, onBack, onClosed }: { code: string; onBack: () => void; onClosed: () => void }) {
  const [dashboard, setDashboard] = useState<ExamDashboard | null>(null);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const load = useCallback(async () => { try { const result = await getExamDashboard(code); if (result.success && result.data) { setDashboard(result.data); setError(''); } else setError(errorText(result)); } catch { setError('Panel yenilənmədi.'); } }, [code]);
  useEffect(() => { const timer = window.setInterval(() => void load(), 10000); void Promise.resolve().then(load); return () => window.clearInterval(timer); }, [load]);
  const close = async () => {
    setClosing(true);
    try { const result = await closeExamSession(code); if (result.success) { await load(); onClosed(); setConfirmClose(false); } else setError(errorText(result)); }
    finally { setClosing(false); }
  };

  if (!dashboard) {
    return (
      <Card>
        {error
          ? <EmptyState icon={<AlertTriangle size={20} />} title="Panel yüklənmədi" text={error} action={<Button variant="outline" onClick={onBack}><ArrowLeft size={15} /> Geri</Button>} />
          : <LoadingState text="Panel yüklənir..." />}
      </Card>
    );
  }

  const completed = dashboard.participants.filter(p => p.submittedAt).length;
  const closed = dashboard.session.isClosed;

  return (
    <div className="es-dashboard">
      <div className="es-dashboard__head">
        <div className="es-player__title">
          <span className="kicker">Sessiya paneli</span>
          <h2>{dashboard.session.title}</h2>
          <div className="es-dashboard__meta">
            <Badge tone={closed ? 'neutral' : 'success'} dot>{closed ? 'Bağlı' : 'Aktiv'}</Badge>
            <span className="text-3 text-sm">{dashboard.session.questionCount} sual · {dashboard.session.durationMinutes} dəq · {formatDate(dashboard.session.createdAt)}</span>
          </div>
        </div>
        <SessionCode code={code} />
      </div>

      <div className="stat-grid">
        <StatCard icon={<Users size={18} />} tone="info" value={dashboard.participants.length} label="İştirakçı" />
        <StatCard icon={<Check size={18} />} tone="success" value={completed} label="Tamamlayan" />
        <StatCard icon={<FileText size={18} />} tone="brand" value={dashboard.session.questionCount} label="Sual" />
      </div>

      <Card padded={false}>
        <div className="es-table-head">
          <h3 className="card__title" style={{ marginBottom: 0 }}><Users size={15} /> İştirakçılar</h3>
          <span className="text-3 text-xs">Hər 10 saniyədə yenilənir</span>
        </div>
        {dashboard.participants.length === 0 ? (
          <EmptyState compact icon={<Users size={20} />} title="Hələ heç kim qoşulmayıb" text="Tələbələr sessiya kodu ilə qoşulduqda burada görünəcək." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tələbə</th>
                  <th>İrəliləyiş</th>
                  <th>Status</th>
                  <th className="is-num">Nəticə</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.participants.map(p => {
                  const done = Boolean(p.submittedAt);
                  return (
                    <tr key={p.id}>
                      <td className="cell-main">{p.name}</td>
                      <td>
                        <div className="es-progress-cell">
                          <ProgressBar value={dashboard.session.questionCount ? (p.answeredCount / dashboard.session.questionCount) * 100 : 0} label={`${p.name}: ${p.answeredCount} / ${dashboard.session.questionCount} cavab`} size="sm" tone={done ? 'success' : 'brand'} />
                          <span className="cell-mono">{p.answeredCount}/{dashboard.session.questionCount}</span>
                        </div>
                      </td>
                      <td>{done ? <Badge tone="success"><Check size={12} /> Göndərilib</Badge> : <Badge tone="warning"><Clock size={12} /> Davam edir</Badge>}</td>
                      <td className="is-num">{done && p.percentage !== null ? <strong>{p.percentage}%</strong> : <span className="text-3">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}

      <div className="es-dashboard__actions">
        <Button variant="outline" onClick={onBack}><ArrowLeft size={15} /> Geri</Button>
        <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} /> Yenilə</Button>
        {!closed && <Button variant="danger" onClick={() => setConfirmClose(true)}><XCircle size={15} /> Sessiyanı bağla</Button>}
      </div>

      <ConfirmDialog
        open={confirmClose}
        title="Sessiyanı bağlamaq istəyirsiniz?"
        confirmLabel="Bəli, bağla"
        busy={closing}
        icon={<XCircle size={15} />}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => void close()}
      >
        Bağlandıqdan sonra tələbələr bu koda qoşula bilməyəcək. Davam edən cəhdlər serverin qaydaları ilə tamamlanır. Bu əməliyyat geri qaytarıla bilməz.
      </ConfirmDialog>
    </div>
  );
}

export default function ExamSession() {
  const loggedIn = Boolean(getToken());
  const roles = getStoredUserRoles().map(role => role.toLowerCase());
  const admin = roles.includes('admin');
  // Yalnız VIP sessiya yarada bilər (müəllim rolu daxil, başqa heç bir rol yox). Server son sözü deyir.
  const vip = !admin && roles.includes('vip');
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

  const sectionHead = (
    <div className="section-heading">
      <div>
        <div className="kicker">İmtahan sistemi</div>
        <h2 id="exam-section-title">İmtahan sessiyaları</h2>
        <p>VIP istifadəçi məxfi sual bankından sessiya yaradır (gündə ən çox 7), iştirakçılar kodla qoşulur və nəticə serverdə avtomatik hesablanır.</p>
      </div>
    </div>
  );

  if (attempt) {
    return (
      <section id="exam-session" className="exam page-section exam--focused" aria-labelledby="exam-section-title">
        <div className="container">
          <h2 id="exam-section-title" className="visually-hidden">İmtahan</h2>
          <ExamPlayer initial={attempt} onExit={() => { setAttempt(null); void loadOverview(); }} />
        </div>
      </section>
    );
  }
  if (dashboardCode) {
    return (
      <section id="exam-session" className="exam page-section" aria-labelledby="exam-section-title">
        <div className="container">
          <h2 id="exam-section-title" className="visually-hidden">Sessiya paneli</h2>
          <TeacherDashboard code={dashboardCode} onBack={() => setDashboardCode(null)} onClosed={() => void loadOverview()} />
        </div>
      </section>
    );
  }

  const recentSession = overview?.sessions[0];
  const quota = vip ? overview?.quota ?? null : null;
  const quotaExhausted = quota !== null && quota.remaining <= 0;

  return (
    <>
      <section id="exam-session" className="exam page-section" aria-labelledby="exam-section-title">
        <div className="container">
          {sectionHead}

          {!loggedIn && (
            <div className="notice notice--info exam__notice">
              <LogIn size={18} />
              <div className="notice__body">
                <strong>İmtahan sistemi üçün hesaba daxil olun</strong>
                <p>Sessiya yaratmaq, qoşulmaq və nəticələri saxlamaq üçün giriş tələb olunur.</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => requestAuth('login')}>Daxil ol</Button>
            </div>
          )}
          {loggedIn && admin && (
            <div className="notice notice--warning exam__notice">
              <Shield size={18} />
              <div className="notice__body">
                <strong>Admin hesabı üçün imtahan fəaliyyəti bağlıdır</strong>
                <p>İdarəetmə əməliyyatlarını kabinetdəki Admin bölməsindən aparın.</p>
              </div>
            </div>
          )}

          <div className="exam__layout">
            <div className="exam__left">
              <Card className="exam__action">
                <CardHead icon={<Plus size={16} />} title="Sessiya yarat" />
                <p className="exam__action-desc">Mövcud kateqoriyalardan sual seçin, vaxt təyin edin və unikal kodu tələbələrlə paylaşın.</p>
                {quota && <QuotaMeter quota={quota} />}
                <Button variant="primary" disabled={!loggedIn || !vip || quotaExhausted} onClick={() => setShowCreate(true)}><Plus size={16} /> Sessiya yarat</Button>
                {loggedIn && !vip && !admin && <span className="field__hint">Bu funksiya yalnız VIP hesablar üçündür.</span>}
                {loggedIn && quota && quotaExhausted && <span className="field__hint">Günlük limit ({quota.dailyLimit} sessiya) dolub — sabah yenidən yarada bilərsiniz.</span>}
              </Card>

              <Card className="exam__action">
                <CardHead icon={<KeyRound size={16} />} title="Sessiyaya qoşul" />
                <p className="exam__action-desc">Sessiya sahibindən aldığınız KBR-XXXXXXXXXXXXXXXX kodunu daxil edin.</p>
                {/* Kod "KBR-" prefiksi + 16 hex simvoldan ibarətdir; giriş yalnız böyük hərf/rəqəm/defisə normallaşdırılır
                    (əvvəlki [^A-F0-9-] filtri "K" və "R" hərflərini silirdi və kod heç vaxt keçərli olmurdu). */}
                <form className="exam__join" onSubmit={join}>
                  <label htmlFor="exam-join-code" className="visually-hidden">Sessiya kodu</label>
                  <input id="exam-join-code" className="input input--mono" value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    placeholder="KBR-1234567890ABCDEF" maxLength={20} disabled={!loggedIn || admin || loading} autoComplete="off" spellCheck={false} />
                  <Button type="submit" variant="primary" disabled={!loggedIn || admin || loading || !code.trim()} loading={loading}><LogIn size={16} /> Qoşul</Button>
                </form>
                {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
              </Card>
            </div>

            <div className="exam__right">
              {vip && recentSession && (
                <Card tone="brand" className="exam__recent">
                  <CardHead icon={<ClipboardList size={16} />} title="Son sessiyanız" action={<Badge tone={recentSession.isClosed ? 'neutral' : 'success'} dot>{recentSession.isClosed ? 'Bağlı' : 'Aktiv'}</Badge>} />
                  <div className="exam__recent-title">{recentSession.title}</div>
                  <SessionCode code={recentSession.code} compact />
                  <div className="exam__recent-stats">
                    <span><strong>{recentSession.questionCount}</strong> sual</span>
                    <span><strong>{recentSession.durationMinutes}</strong> dəqiqə</span>
                  </div>
                  <Button variant="primary" onClick={() => setDashboardCode(recentSession.code)}>Canlı paneli aç <ChevronRight size={15} /></Button>
                </Card>
              )}

              {!admin && (
                <Card padded={false}>
                  <div className="es-table-head">
                    <h3 className="card__title" style={{ marginBottom: 0 }}><ClipboardList size={15} /> {vip ? 'Sessiyalarım' : 'İmtahan tarixçəm'}</h3>
                  </div>
                  <div className="list">
                    {vip ? overview?.sessions.map(session => (
                      <button type="button" className="list__row exam__item" key={session.id} onClick={() => setDashboardCode(session.code)}>
                        <Badge tone={session.isClosed ? 'neutral' : 'success'} dot>{session.isClosed ? 'Bağlı' : 'Aktiv'}</Badge>
                        <span className="list__main">
                          <span className="list__title">{session.title}</span>
                          <span className="list__meta">{session.questionCount} sual · {session.durationMinutes} dəq · {formatDate(session.createdAt)}</span>
                        </span>
                        <span className="list__end"><ChevronRight size={16} /></span>
                      </button>
                    )) : overview?.attempts.map(item => (
                      <button type="button" className="list__row exam__item" key={item.id} onClick={() => void resume(item.id)} disabled={loading}>
                        {item.submittedAt
                          ? <Badge tone="success">{item.percentage ?? 0}%</Badge>
                          : <Badge tone="warning" dot>Davam edir</Badge>}
                        <span className="list__main">
                          <span className="list__title">{item.session.title}</span>
                          <span className="list__meta">{item.session.teacherName} · {item.session.questionCount} sual</span>
                        </span>
                        <span className="list__end"><ChevronRight size={16} /></span>
                      </button>
                    ))}
                    {!loggedIn && <EmptyState compact icon={<Lock size={18} />} title="Giriş tələb olunur" text="Sessiyalar və nəticələr hesabla daxil olduqdan sonra görünür." />}
                    {loggedIn && ((vip && !overview?.sessions.length) || (!vip && !overview?.attempts.length)) && (
                      <EmptyState compact icon={<ClipboardList size={18} />} title="Hələ heç bir qeyd yoxdur" text={vip ? 'İlk sessiyanı yaratdıqda burada görünəcək.' : 'Kodla qoşulduğunuz imtahanlar burada görünəcək.'} />
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>
      {showCreate && <CreateSessionModal quota={quota} onClose={() => setShowCreate(false)} onCreated={() => void loadOverview()} />}
    </>
  );
}
