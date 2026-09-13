import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle, XCircle, Trophy, Home, Layers, Cpu, Shield, Shuffle, Play,
  Info, LogIn, HelpCircle, BarChart2, RotateCcw, Lock, Circle,
} from 'lucide-react';
import { fetchQuizCategories, fetchQuizQuestions, submitAnswer, NETWORK_MAIN_ID } from '../services/quizService';
import type { NetworkTopicFilter } from '../services/quizService';
import type { DifficultyLevel, OptionKey, Question, KnowledgeCategory } from '../data/mockData';
import { requestAuth } from '../utils/authUi';
import { categoryIcon } from '../utils/categoryIcon';
import DashboardShell from './layout/DashboardShell';
import Sidebar, { SidebarPromo } from './layout/Sidebar';
import Breadcrumb from './layout/Breadcrumb';
import { Badge, Button, Card, CardHead, ConfirmDialog, LoadingState, EmptyState, ProgressBar } from './ui';
import './QuizView.css';

// ─── Quiz ─────────────────────────────────────────────────────
// Ekran vəziyyətləri: hazırlıq → aktiv → nəticə. Doğru cavab yalnız serverin
// submit cavabından gəlir (client-də cavab açarı yoxdur). Anonim istifadəçi
// sualları oxuya bilər; cavabın yoxlanışı və izahlar hesab tələb edir.

type FilterMode = 'Qarışıq' | DifficultyLevel;

interface QuizViewProps {
  categoryId: number;
  onGoHome: () => void;
  onSelectCategory?: (id: number) => void;
}

const QUESTION_COUNTS = [10, 20, 30, 40, 50];
const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = { 'Başlanğıc': 'success', 'Orta': 'warning', 'Peşəkar': 'danger' };

// ─── Main Component ───────────────────────────────────────────
export default function QuizView({ categoryId, onGoHome, onSelectCategory }: QuizViewProps) {
  // ── Kateqoriya datası (service-dən yüklənir) ───────────────
  const [allCategories, setAllCategories] = useState<KnowledgeCategory[]>([]);

  useEffect(() => {
    fetchQuizCategories().then(setAllCategories);
  }, []);

  const category = allCategories.find(c => c.id === categoryId);

  // ── Setup state (before quiz starts) ──────────────────────
  const [filter, setFilter]               = useState<FilterMode>('Qarışıq');
  const [questionCount, setQuestionCount] = useState(10);
  const [quizStarted, setQuizStarted]     = useState(false);
  const [starting, setStarting]           = useState(false);
  const [startError, setStartError]       = useState<string | null>(null);
  // Yalnız Network kateqoriyası üçün mövzu filtri
  const [topicFilter, setTopicFilter]     = useState<NetworkTopicFilter>('Qarışıq');
  const isNetworkCategory = categoryId === NETWORK_MAIN_ID;

  // ── In-quiz state ──────────────────────────────────────────
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [selected, setSelected]       = useState<OptionKey | null>(null);
  const [answers, setAnswers]         = useState<Record<number, OptionKey>>({});
  const [finished, setFinished]       = useState(false);
  // submit tamamlanana qədər növbəti sual bloklanır
  const [isSubmitting, setIsSubmitting] = useState(false);
  // submitAnswer uğursuz olduqda xəta mesajı
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Giriş tələbi adi xətadan ayrılır: mətn deyil, ayrıca panel göstərilir.
  const [authRequired, setAuthRequired] = useState(false);
  // server nəticəsi ayrı saxlanılır (score üçün etibarlı mənbə)
  const [serverResults, setServerResults] = useState<Record<number, { isCorrect: boolean; correctKey: OptionKey }>>({});
  // Aktiv quiz zamanı başqa kateqoriyaya keçid təsdiq tələb edir
  const [pendingCategory, setPendingCategory] = useState<number | null>(null);

  // ── Available pool count ───────────────────────────────────
  // Network kateqoriyasında mövzu filtrinə görə ayrıca say quizService-dən gəlmir,
  // ona görə kateqoriyanın ümumi sayı göstərilir (real say fetchQuizQuestions-da müəyyən olur).
  const maxAvailable = category?.questionCount ?? 0;
  const effectiveCount = Math.min(questionCount, maxAvailable);

  // ── Start quiz (async — service-dən sualları çəkir) ───────
  const handleStart = useCallback(async () => {
    const difficulty = filter === 'Qarışıq' ? null : filter;
    const topic = isNetworkCategory ? topicFilter : undefined;
    setStarting(true);
    const fetched = await fetchQuizQuestions(categoryId, difficulty, effectiveCount, topic);
    setStarting(false);
    if (fetched.length === 0) {
      setStartError('Bu seçim üçün hələ sual yoxdur.');
      setQuizStarted(false);
      return;
    }
    setQuestions(fetched);
    setCurrentIdx(0);
    setSelected(null);
    setAnswers({});
    setFinished(false);
    setStartError(null);
    setIsSubmitting(false);
    setSubmitError(null);
    setServerResults({});
    setQuizStarted(true);
    window.scrollTo({ top: 0 });
  }, [categoryId, filter, effectiveCount, topicFilter, isNetworkCategory]);

  const current = questions[currentIdx];
  const total   = questions.length;

  // submit tamamlanana qədər Next bloklanır, bütün izahlar göstərilir
  const handleSelect = useCallback(async (key: OptionKey) => {
    if (answers[current?.id] !== undefined) return;
    if (isSubmitting) return;

    setSelected(key);
    setAnswers(prev => ({ ...prev, [current.id]: key }));
    setIsSubmitting(true);
    setSubmitError(null);
    setAuthRequired(false);

    const result = await submitAnswer(current.id, key);

    // Seçimi geri alan ortaq addım: cavab qeyd olunmuş kimi qalmamalıdır.
    const rollbackSelection = () => {
      setSelected(null);
      setAnswers(prev => {
        const next = { ...prev };
        delete next[current.id];
        return next;
      });
    };

    if (result.status === 'ok') {
      // server nəticəsini ayrı state-də saxla (score üçün)
      setServerResults(prev => ({
        ...prev,
        [current.id]: { isCorrect: result.isCorrect, correctKey: result.correctKey },
      }));
      // bütün 4 variantın izahını set et
      setQuestions(prev => prev.map(q =>
        q.id === current.id
          ? {
              ...q,
              correctKey: result.correctKey,
              options: q.options.map(o => {
                const serverOpt = result.options.find(r => r.key === o.key);
                return serverOpt ? { ...o, explanation: serverOpt.explanation } : o;
              }),
            }
          : q,
      ));
    } else if (result.status === 'auth-required') {
      // Sualları hər kəs görə bilər, cavabın yoxlanışı isə hesaba bağlıdır.
      setAuthRequired(true);
      rollbackSelection();
    } else {
      setSubmitError(result.message);
      rollbackSelection();
    }

    setIsSubmitting(false);
  }, [answers, current, isSubmitting]);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= total) return;
    setCurrentIdx(idx);
    // Cavab verilibsə bərpa olunur (yalnız oxunur), yoxsa təmizlənir
    setSelected(answers[questions[idx]?.id] ?? null);
  }, [total, answers, questions]);

  const handleNext = useCallback(() => {
    if (currentIdx < total - 1) goTo(currentIdx + 1);
    else setFinished(true);
  }, [currentIdx, total, goTo]);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) goTo(currentIdx - 1);
  }, [currentIdx, goTo]);

  const handleRestart = useCallback(() => {
    setQuizStarted(false);
    setCurrentIdx(0);
    setSelected(null);
    setAnswers({});
    setFinished(false);
    setQuestions([]);
    setStartError(null);
    setTopicFilter('Qarışıq');
    setIsSubmitting(false);
    setSubmitError(null);
    setServerResults({});
    setAuthRequired(false);
    window.scrollTo({ top: 0 });
  }, []);

  // score serverResults-dan hesablanır (questions.correctKey-ə deyil)
  const score = useMemo(() => {
    const correct = questions.filter(q => serverResults[q.id]?.isCorrect === true).length;
    const byLevel = (['Başlanğıc', 'Orta', 'Peşəkar'] as DifficultyLevel[]).map(lvl => {
      const lvlQs = questions.filter(q => q.difficulty === lvl);
      const lvlCorrect = lvlQs.filter(q => serverResults[q.id]?.isCorrect === true).length;
      return { lvl, correct: lvlCorrect, total: lvlQs.length };
    }).filter(l => l.total > 0);
    return { correct, total: questions.length, byLevel };
  }, [questions, serverResults]);

  const percent = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const answeredCount = Object.keys(answers).length;

  // ── Klaviatura: A–D / 1–4 seçir, ← → sual dəyişir ───────────
  const inActiveQuiz = quizStarted && !finished && !!current;
  useEffect(() => {
    if (!inActiveQuiz) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      const map: Record<string, OptionKey> = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
      if (map[k] && !isSubmitting && selected === null) { e.preventDefault(); void handleSelect(map[k]); return; }
      if (e.key === 'ArrowRight' && selected !== null && !isSubmitting) { e.preventDefault(); handleNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inActiveQuiz, isSubmitting, selected, handleSelect, handleNext, handlePrev]);

  // ── Yan panel: kateqoriya siyahısı (real say ilə) ───────────
  const sidebarItems = useMemo(() => allCategories.map(c => ({
    id: c.id,
    label: c.title,
    icon: categoryIcon(c.icon, 17),
    meta: `${c.questionCount} sual`,
  })), [allCategories]);

  const requestCategory = (id: number) => {
    if (id === categoryId || !onSelectCategory) return;
    if (inActiveQuiz && answeredCount > 0) { setPendingCategory(id); return; }
    onSelectCategory(id);
  };

  const sidebar = (
    <Sidebar
      title="Biliklər"
      ariaLabel="Bilik kateqoriyaları"
      items={sidebarItems}
      value={categoryId}
      onSelect={requestCategory}
      idPrefix="qv-cat"
      footer={<SidebarPromo onClick={onGoHome} />}
    />
  );

  const crumbs = [
    { label: 'Biliklər', onClick: onGoHome },
    { label: category?.title ?? '...', onClick: quizStarted ? handleRestart : undefined },
    ...(quizStarted ? [{ label: finished ? 'Nəticə' : 'Quiz' }] : []),
  ];

  // yüklənir vs tapılmadı fərqləndirilir
  if (!category) {
    const isLoading = allCategories.length === 0;
    return (
      <DashboardShell sidebar={sidebar} sidebarLabel="Biliklər">
        <Card>
          {isLoading
            ? <LoadingState text="Quiz məlumatları yüklənir..." />
            : <EmptyState icon={<HelpCircle size={20} />} title="Kateqoriya tapılmadı"
                action={<Button variant="primary" onClick={onGoHome}><Home size={15} /> Biliklərə qayıt</Button>} />}
        </Card>
      </DashboardShell>
    );
  }

  const switchDialog = (
    <ConfirmDialog
      open={pendingCategory !== null}
      title="Kateqoriyanı dəyişmək istəyirsiniz?"
      confirmLabel="Bəli, dəyiş"
      tone="primary"
      icon={<Layers size={15} />}
      onCancel={() => setPendingCategory(null)}
      onConfirm={() => { const id = pendingCategory; setPendingCategory(null); if (id !== null) onSelectCategory?.(id); }}
    >
      Cari quiz dayandırılacaq və bu sessiyanın nəticəsi göstərilməyəcək. Artıq yoxlanılmış cavablar
      hesabınızda qalır.
    </ConfirmDialog>
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER: SETUP SCREEN (before quiz starts)
  // ═══════════════════════════════════════════════════════════
  if (!quizStarted) {
    const filters: FilterMode[] = ['Qarışıq', 'Başlanğıc', 'Orta', 'Peşəkar'];
    const filterIcons: Record<FilterMode, ReactNode> = {
      Qarışıq: <Shuffle size={13} />, Başlanğıc: <Circle size={11} />, Orta: <Circle size={11} />, Peşəkar: <Circle size={11} />,
    };

    const networkTopics: NetworkTopicFilter[] = ['Qarışıq', 'Network Security', 'Network Attacks'];
    const networkTopicIcons: Record<NetworkTopicFilter, ReactNode> = {
      'Qarışıq':          <Shuffle size={13} />,
      'Network Security': <Shield size={13} />,
      'Network Attacks':  <Cpu size={13} />,
    };

    let step = 0;
    const nextStep = () => String(++step);

    const rail = (
      <>
        <Card padded="sm">
          <CardHead icon={<Info size={15} />} title="Seçiminiz" />
          <dl className="qv-summary">
            <div><dt>Kateqoriya</dt><dd>{category.title}</dd></div>
            {isNetworkCategory && <div><dt>Mövzu</dt><dd>{topicFilter}</dd></div>}
            <div><dt>Çətinlik</dt><dd>{filter}</dd></div>
            <div><dt>Sual sayı</dt><dd>{effectiveCount}</dd></div>
            <div><dt>Mövcud sual</dt><dd>{maxAvailable}</dd></div>
          </dl>
        </Card>
        <Card padded="sm" tone="brand">
          <CardHead icon={<Lock size={15} />} title="Qeyd" />
          <p className="note">Sualları qeydiyyatsız oxuya bilərsiniz. Cavabın yoxlanışı, izahlar və nəticənin kabinetdə toplanması üçün hesabla daxil olun.</p>
        </Card>
      </>
    );

    return (
      <DashboardShell sidebar={sidebar} rail={rail} sidebarLabel="Biliklər">
        <Breadcrumb items={crumbs} />
        <Card className="qv-setup">
          <div className="qv-setup__head">
            <span className="qv-setup__icon" aria-hidden="true">{categoryIcon(category.icon, 24)}</span>
            <div className="qv-setup__meta">
              <span className="kicker">Quiz{category.difficulty ? ` · ${category.difficulty}` : ''}</span>
              <h1 className="qv-setup__title">{category.title}</h1>
              <p className="qv-setup__desc">{category.description}</p>
            </div>
          </div>

          {/* Step — Mövzu filtri (yalnız Network kateqoriyasında) */}
          {isNetworkCategory && (
            <fieldset className="qv-step">
              <legend className="qv-step__label"><span className="qv-step__num">{nextStep()}</span> Mövzu növünü seçin</legend>
              <div className="segmented" role="group" aria-label="Mövzu filtri">
                {networkTopics.map(t => (
                  <button key={t} id={`qv-topic-${t.replace(/\s/g, '-')}`} type="button" className="segmented__btn"
                    onClick={() => setTopicFilter(t)} aria-pressed={topicFilter === t}>
                    {networkTopicIcons[t]} {t}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Step — Difficulty */}
          <fieldset className="qv-step">
            <legend className="qv-step__label"><span className="qv-step__num">{nextStep()}</span> Çətinlik səviyyəsi seçin</legend>
            <div className="segmented" role="group" aria-label="Çətinlik filtri">
              {filters.map(f => (
                <button key={f} id={`qv-filter-${f}`} type="button" className={`segmented__btn qv-level qv-level--${f}`}
                  onClick={() => setFilter(f)} aria-pressed={filter === f}>
                  {filterIcons[f]} {f}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Step — Question count */}
          <fieldset className="qv-step">
            <legend className="qv-step__label">
              <span className="qv-step__num">{nextStep()}</span> Sual sayını seçin
              {maxAvailable > 0 && <span className="qv-step__hint">({maxAvailable} sual mövcuddur)</span>}
            </legend>
            <div className="segmented qv-counts" role="group" aria-label="Sual sayı">
              {QUESTION_COUNTS.map(n => {
                const disabled = n > maxAvailable;
                const isActive = questionCount === n && !disabled;
                return (
                  <button key={n} id={`qv-count-${n}`} type="button" className="segmented__btn"
                    onClick={() => { if (!disabled) setQuestionCount(n); }} disabled={disabled} aria-pressed={isActive}
                    title={disabled ? 'Bu sayda sual mövcud deyil' : undefined}>
                    {n}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Start */}
          <div className="qv-setup__actions">
            {maxAvailable === 0 ? (
              <div className="notice notice--warning" role="status"><Info size={16} /><span>Bu filtrdə hələ sual əlavə edilməyib.</span></div>
            ) : (
              <>
                {startError && <div className="notice notice--warning" role="alert"><Info size={16} /><span>{startError}</span></div>}
                <Button id="qv-start-quiz-btn" variant="primary" size="lg" onClick={handleStart} loading={starting}>
                  <Play size={16} /> {effectiveCount} sual ilə başla <ArrowRight size={16} />
                </Button>
              </>
            )}
          </div>
        </Card>
        {switchDialog}
      </DashboardShell>
    );
  }

  if (!current) {
    return (
      <DashboardShell sidebar={sidebar} sidebarLabel="Biliklər">
        <Card>
          <EmptyState icon={<HelpCircle size={20} />} title="Bu seçim üçün sual tapılmadı"
            action={<Button id="qv-restart-btn" variant="primary" onClick={handleRestart}><ArrowLeft size={15} /> Geri qayıt</Button>} />
        </Card>
      </DashboardShell>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: SCOREBOARD
  // ═══════════════════════════════════════════════════════════
  if (finished) {
    const tone: 'success' | 'warning' | 'brand' = percent >= 80 ? 'success' : percent >= 60 ? 'warning' : 'brand';
    return (
      <DashboardShell sidebar={sidebar} sidebarLabel="Biliklər">
        <Breadcrumb items={crumbs} />
        <Card className="qv-result">
          <div className={`qv-result__icon qv-result__icon--${tone}`} aria-hidden="true"><Trophy size={26} /></div>
          <span className="kicker">Quiz tamamlandı</span>
          <h1 className="qv-result__title">Nəticəniz</h1>
          <div className="qv-result__big" aria-label={`${score.correct} düzgün, ${score.total} sualdan`}>
            <span className="qv-result__num">{score.correct}</span>
            <span className="qv-result__sep">/</span>
            <span className="qv-result__denom">{score.total}</span>
          </div>
          <div className="qv-result__pct">{percent}% düzgün cavab</div>
          <ProgressBar value={percent} label="Ümumi nəticə" tone={tone === 'brand' ? 'brand' : tone} size="lg" />

          {score.byLevel.length > 1 && (
            <div className="qv-result__breakdown">
              <div className="qv-result__breakdown-title"><BarChart2 size={14} /> Çətinlik üzrə</div>
              {score.byLevel.map(({ lvl, correct: c, total: t }) => (
                <div key={lvl} className="qv-result__row">
                  <Badge tone={DIFFICULTY_TONE[lvl] ?? 'neutral'} dot>{lvl}</Badge>
                  <ProgressBar value={t > 0 ? (c / t) * 100 : 0} label={`${lvl}: ${c} / ${t}`} size="sm" />
                  <span className="qv-result__fraction">{c}/{t}</span>
                </div>
              ))}
            </div>
          )}

          {answeredCount < score.total && (
            <p className="note">{score.total - answeredCount} sual cavabsız qaldı — nəticə yalnız serverdə yoxlanılmış cavablara görə hesablanır.</p>
          )}

          <div className="qv-result__actions">
            <Button id="qv-restart-btn" variant="primary" onClick={handleRestart}><RotateCcw size={15} /> Yenidən başla</Button>
            <Button id="qv-home-btn" variant="outline" onClick={onGoHome}><Home size={15} /> Biliklərə qayıt</Button>
          </div>
        </Card>
        {switchDialog}
      </DashboardShell>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: ACTIVE QUIZ
  // ═══════════════════════════════════════════════════════════
  const isAnswered = selected !== null && !isSubmitting;
  const currentResult = serverResults[current.id];

  const rail = (
    <>
      <Card padded="sm">
        <CardHead icon={<Layers size={15} />} title="Sual naviqatoru" />
        <ul className="qnav-legend" aria-hidden="true">
          <li><span className="qnav-legend__dot qnav-legend__dot--correct" /> Düzgün</li>
          <li><span className="qnav-legend__dot qnav-legend__dot--wrong" /> Yanlış</li>
          <li><span className="qnav-legend__dot qnav-legend__dot--current" /> Hazırkı</li>
          <li><span className="qnav-legend__dot" /> Cavablanmayıb</li>
        </ul>
        <div className="qnav-grid" role="group" aria-label="Suallar">
          {questions.map((q, i) => {
            const r = serverResults[q.id];
            const state = r ? (r.isCorrect ? 'correct' : 'wrong') : 'open';
            const isCurrent = i === currentIdx;
            return (
              <button
                key={q.id}
                type="button"
                className={`qnav-btn qnav-btn--${state}${isCurrent ? ' is-current' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Sual ${i + 1}${r ? (r.isCorrect ? ', düzgün' : ', yanlış') : ', cavablanmayıb'}`}
                onClick={() => { if (!isSubmitting) goTo(i); }}
                disabled={isSubmitting}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </Card>
      <Card padded="sm">
        <CardHead icon={<Info size={15} />} title="Sual məlumatı" />
        <dl className="qv-summary">
          <div><dt>Kateqoriya</dt><dd>{category.title}</dd></div>
          <div><dt>Çətinlik</dt><dd><Badge tone={DIFFICULTY_TONE[current.difficulty] ?? 'neutral'} dot>{current.difficulty}</Badge></dd></div>
          <div><dt>Cavablanıb</dt><dd>{answeredCount} / {total}</dd></div>
          <div><dt>Klaviatura</dt><dd className="mono">A–D · ← →</dd></div>
        </dl>
      </Card>
    </>
  );

  return (
    <DashboardShell sidebar={sidebar} rail={rail} sidebarLabel="Biliklər">
      <Breadcrumb items={crumbs} />

      <div className="qv-topbar">
        <div className="qv-topbar__title">
          <span className="kicker">Quiz</span>
          <h1>{category.title}</h1>
        </div>
        <div className="qv-topbar__progress">
          <span className="qv-topbar__count">Sual <strong>{currentIdx + 1}</strong> / {total}</span>
          <ProgressBar value={((currentIdx + 1) / total) * 100} label={`Sual ${currentIdx + 1} / ${total}`} size="sm" />
        </div>
      </div>

      <Card className="qv-question" key={current.id}>
        <div className="qv-question__head">
          <Badge tone={DIFFICULTY_TONE[current.difficulty] ?? 'neutral'} dot>{current.difficulty}</Badge>
          {currentResult && (
            <Badge tone={currentResult.isCorrect ? 'success' : 'danger'}>
              {currentResult.isCorrect ? <><CheckCircle size={12} /> Düzgün</> : <><XCircle size={12} /> Yanlış</>}
            </Badge>
          )}
        </div>
        <p className="qv-question__text">{current.question}</p>

        {/* Giriş tələb olunur — cavabın yoxlanışı hesaba bağlıdır */}
        {authRequired && (
          <div className="notice notice--info qv-gate" role="status">
            <LogIn size={16} />
            <div className="notice__body">
              <strong>Cavabı yoxlamaq üçün daxil olun.</strong>
              <p>Sualları giriş etmədən oxuya bilərsiniz, lakin cavabın düzgünlüyü və izahlar yalnız hesabla göstərilir — nəticəniz də kabinetinizdə toplanır.</p>
              <div className="qv-gate__actions">
                <Button variant="primary" size="sm" onClick={() => requestAuth('login')}><LogIn size={14} /> Daxil ol</Button>
                <Button variant="ghost" size="sm" onClick={() => requestAuth('register')}>Qeydiyyat</Button>
              </div>
            </div>
          </div>
        )}

        {submitError && (
          <div className="notice notice--danger" role="alert"><XCircle size={16} /><span>{submitError}</span></div>
        )}

        {/* ── Options ── */}
        <div className="qv-options" role="group" aria-label="Cavab variantları">
          {current.options.map(opt => {
            const isCorrect  = opt.key === current.correctKey;
            const isSelected = opt.key === selected;

            let state = '';
            if (isAnswered) {
              if (isCorrect)       state = 'correct';
              else if (isSelected) state = 'wrong';
              else                 state = 'dim';
            } else if (isSubmitting && isSelected) {
              state = 'pending';
            }

            const disabled = isAnswered || isSubmitting;
            return (
              <div key={opt.key} className={`qv-option${state ? ` qv-option--${state}` : ''}`}>
                <button
                  id={`qv-opt-${opt.key}`}
                  type="button"
                  className="qv-option__btn"
                  onClick={() => handleSelect(opt.key)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-describedby={isAnswered ? `qv-exp-${opt.key}` : undefined}
                >
                  <span className="qv-option__key" aria-hidden="true">{opt.key}</span>
                  <span className="qv-option__text">{opt.text}</span>
                  <span className="qv-option__icon" aria-hidden="true">
                    {state === 'correct' && <CheckCircle size={18} />}
                    {state === 'wrong' && <XCircle size={18} />}
                    {state === 'pending' && <span className="spinner spinner--sm" />}
                  </span>
                  {isAnswered && (
                    <span className="visually-hidden">{isCorrect ? 'düzgün cavab' : isSelected ? 'seçdiyiniz yanlış cavab' : 'yanlış variant'}</span>
                  )}
                </button>

                {/* Explanation — all options revealed after answer */}
                {isAnswered && opt.explanation && (
                  <div className="qv-explanation" id={`qv-exp-${opt.key}`} aria-live="polite">
                    <span className="qv-explanation__label">
                      {isCorrect ? <><CheckCircle size={13} /> Açıqlama</> : <><Info size={13} /> Niyə yanlış?</>}
                    </span>
                    <p className="qv-explanation__text">
                      {opt.explanation.startsWith('Düzgün cavab.') ? (
                        <>
                          <span className="qv-exp-prefix qv-exp-prefix--correct">Düzgün cavab</span>
                          {opt.explanation.substring('Düzgün cavab.'.length)}
                        </>
                      ) : opt.explanation.startsWith('Yanlış.') ? (
                        <>
                          <span className="qv-exp-prefix qv-exp-prefix--wrong">Yanlış</span>
                          {opt.explanation.substring('Yanlış.'.length)}
                        </>
                      ) : (
                        opt.explanation
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Navigation: Back (read-only) + Next (after answering) ── */}
        <div className="qv-nav">
          <Button id="qv-prev-btn" variant="outline" onClick={handlePrev} disabled={currentIdx === 0} aria-label="Əvvəlki sual">
            <ArrowLeft size={15} /> Əvvəlki sual
          </Button>
          <div className="qv-nav__right">
            {isSubmitting && <span className="inline-status" role="status"><span className="spinner spinner--sm" /> Yoxlanılır...</span>}
            {selected !== null && !isSubmitting && (
              <Button id="qv-next-btn" variant="primary" onClick={handleNext} aria-label={currentIdx === total - 1 ? 'Nəticəni gör' : 'Növbəti sual'}>
                {currentIdx === total - 1
                  ? <><Trophy size={15} /> Nəticəni gör</>
                  : <>Növbəti sual <ArrowRight size={15} /></>}
              </Button>
            )}
          </div>
        </div>
      </Card>
      {switchDialog}
    </DashboardShell>
  );
}
