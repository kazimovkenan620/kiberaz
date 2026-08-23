import { useState, useMemo, useCallback, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Trophy, Hash, Home, Layers, Cpu, Shield } from 'lucide-react';
import { fetchQuizCategories, fetchQuizQuestions, submitAnswer, NETWORK_MAIN_ID } from '../services/quizService';
import type { NetworkTopicFilter } from '../services/quizService';
import type { DifficultyLevel, OptionKey, Question, KnowledgeCategory } from '../data/mockData';
import './QuizView.css';

// ─── Types ────────────────────────────────────────────────────
type FilterMode = 'Qarışıq' | DifficultyLevel;

interface QuizViewProps {
  categoryId: number;
  onGoHome: () => void;
}


const QUESTION_COUNTS = [10, 20, 30, 40, 50];

// ─── Main Component ───────────────────────────────────────────
export default function QuizView({ categoryId, onGoHome }: QuizViewProps) {
  // ── Kateqoriya datası (service-dən yüklənir) ───────────────
  const [allCategories, setAllCategories] = useState<KnowledgeCategory[]>([]);

  useEffect(() => {
    fetchQuizCategories().then(setAllCategories);
  }, []);

  const category = allCategories.find(c => c.id === categoryId);
  const catColor = category?.color ?? '#00d4ff';

  // ── Setup state (before quiz starts) ──────────────────────
  const [filter, setFilter]               = useState<FilterMode>('Qarışıq');
  const [questionCount, setQuestionCount] = useState(10);
  const [quizStarted, setQuizStarted]     = useState(false);
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
  // Fix 1+2: submit tamamlanana qədər növbəti sual bloklanır
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Fix 5: submitAnswer uğursuz olduqda xəta mesajı
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Fix 1: server nəticəsi ayrı saxlanılır (score üçün etibarlı mənbə)
  const [serverResults, setServerResults] = useState<Record<number, { isCorrect: boolean; correctKey: OptionKey }>>({});

  // ── Available pool count (mövzu filtrinə görə hesablanır) ──
  const maxAvailable = useMemo(() => {
    if (!isNetworkCategory) return category?.questionCount ?? 0;
    // Network kateqoriyasında topicFilter-ə görə sual sayını hesabla
    // Bu məlumat quizService-dən gəlmir, buna görə kateqoriyanın ümumi sayından istifadə edirik
    // (real saylar fetchQuizQuestions çağırışında müəyyən olur)
    return category?.questionCount ?? 0;
  }, [isNetworkCategory, category, topicFilter]);
  const effectiveCount = Math.min(questionCount, maxAvailable);

  // ── Start quiz (async — service-dən sualları çəkir) ───────
  const handleStart = useCallback(async () => {
    const difficulty = filter === 'Qarışıq' ? null : filter;
    const topic = isNetworkCategory ? topicFilter : undefined;
    const fetched = await fetchQuizQuestions(categoryId, difficulty, effectiveCount, topic);
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
  }, [categoryId, filter, effectiveCount, topicFilter, isNetworkCategory]);

  const current = questions[currentIdx];
  const total   = questions.length;

  // Fix 1+2+3+5+8: submit tamamlanana qədər Next bloklanır, bütün izahlar göstərilir
  const handleSelect = useCallback(async (key: OptionKey) => {
    if (answers[current?.id] !== undefined) return;
    if (isSubmitting) return;

    setSelected(key);
    setAnswers(prev => ({ ...prev, [current.id]: key }));
    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submitAnswer(current.id, key);

    if (result) {
      // Fix 1: server nəticəsini ayrı state-də saxla (score üçün)
      setServerResults(prev => ({
        ...prev,
        [current.id]: { isCorrect: result.isCorrect, correctKey: result.correctKey },
      }));
      // Fix 3: bütün 4 variantın izahını set et
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
    } else {
      // Fix 5: submitAnswer uğursuz oldu — xəta göstər, cavabı geri al
      setSubmitError('Cavab yoxlanılarkən xəta baş verdi. Yenidən cəhd edin.');
      setSelected(null);
      setAnswers(prev => {
        const next = { ...prev };
        delete next[current.id];
        return next;
      });
    }

    setIsSubmitting(false);
  }, [answers, current, isSubmitting]);

  const handleNext = useCallback(() => {
    if (currentIdx < total - 1) {
      const nextIdx = currentIdx + 1;
      const nextQ   = questions[nextIdx];
      setCurrentIdx(nextIdx);
      // Restore answer if already given, otherwise clear
      setSelected(answers[nextQ?.id] ?? null);
    } else {
      setFinished(true);
    }
  }, [currentIdx, total, questions, answers]);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      const prevQ   = questions[prevIdx];
      setCurrentIdx(prevIdx);
      // Restore the previously given answer (read-only)
      setSelected(answers[prevQ?.id] ?? null);
    }
  }, [currentIdx, questions, answers]);

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
  }, []);

  // Fix 1: score serverResults-dan hesablanır (questions.correctKey-ə deyil)
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

  const cssVars = { '--qv-clr': catColor } as CSSProperties;

  // Fix 9: yüklənir vs tapılmadı fərqləndirilir
  if (!category) {
    const isLoading = allCategories.length === 0;
    return (
      <div className="qv-page" style={cssVars}>
        <div className="qv-setup-wrap">
          {isLoading ? (
            <div className="qv-loading">Quiz məlumatları yüklənir...</div>
          ) : (
            <>
              <div className="qv-no-questions">Kateqoriya tapılmadı.</div>
              <button className="qv-btn-start" onClick={onGoHome}>Ana Səhifəyə Qayıt</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: SETUP SCREEN (before quiz starts)
  // ═══════════════════════════════════════════════════════════
  if (!quizStarted) {
    const filters: FilterMode[] = ['Qarışıq', 'Başlanğıc', 'Orta', 'Peşəkar'];
    const filterIcons: Record<FilterMode, string> = {
      Qarışıq: '🔀', Başlanğıc: '🟢', Orta: '🟡', Peşəkar: '🔴',
    };

    const networkTopics: NetworkTopicFilter[] = ['Qarışıq', 'Network Security', 'Network Attacks'];
    const networkTopicIcons: Record<NetworkTopicFilter, ReactNode> = {
      'Qarışıq':         <span aria-hidden="true">🔀</span>,
      'Network Security':<Shield size={13} />,
      'Network Attacks': <Cpu size={13} />,
    };

    return (
      <div className="qv-page" style={cssVars}>
        <div className="qv-setup-wrap">
          <div className="qv-setup-glow" aria-hidden="true" />

          <button id="qv-back-categories-btn" className="qv-back" onClick={onGoHome}>
            <Layers size={15} /> Biliklərə Qayıt
          </button>

          {/* Category badge */}
          <div className="qv-cat-hero">
            <span className="qv-cat-emoji">{category.icon}</span>
            <h1 className="qv-cat-title">{category.title}</h1>
            <p className="qv-cat-desc">{category.description}</p>
          </div>

          {/* Step 0 — Mövzu filtri (yalnız Network kateqoriyasında) */}
          {isNetworkCategory && (
            <div className="qv-setup-section">
              <div className="qv-setup-label">
                <span className="qv-setup-step">1</span>
                Mövzu növünü seçin
              </div>
              <div className="qv-filter-bar" role="group" aria-label="Mövzu filtri">
                {networkTopics.map(t => (
                  <button
                    key={t}
                    id={`qv-topic-${t.replace(/\s/g, '-')}`}
                    className={`qv-filter-btn ${topicFilter === t ? 'qv-filter-btn--active' : ''}`}
                    onClick={() => setTopicFilter(t)}
                    aria-pressed={topicFilter === t}
                  >
                    {networkTopicIcons[t]} {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Difficulty */}
          <div className="qv-setup-section">
            <div className="qv-setup-label">
              <span className="qv-setup-step">{isNetworkCategory ? '2' : '1'}</span>
              Çətinlik səviyyəsi seçin
            </div>
            <div className="qv-filter-bar" role="group" aria-label="Çətinlik filtri">
              {filters.map(f => (
                <button
                  key={f}
                  id={`qv-filter-${f}`}
                  className={`qv-filter-btn ${filter === f ? 'qv-filter-btn--active' : ''}`}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                >
                  <span aria-hidden="true">{filterIcons[f]}</span> {f}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Question count */}
          <div className="qv-setup-section">
            <div className="qv-setup-label">
              <span className="qv-setup-step">{isNetworkCategory ? '3' : '2'}</span>
              Sual sayını seçin
              {maxAvailable > 0 && (
                <span className="qv-available-note">
                  ({maxAvailable} sual mövcuddur)
                </span>
              )}
            </div>
            <div className="qv-count-bar" role="group" aria-label="Sual sayı">
              {QUESTION_COUNTS.map(n => {
                const disabled = n > maxAvailable;
                const isActive = questionCount === n && !disabled;
                return (
                  <button
                    key={n}
                    id={`qv-count-${n}`}
                    className={`qv-count-btn ${isActive ? 'qv-count-btn--active' : ''} ${disabled ? 'qv-count-btn--disabled' : ''}`}
                    onClick={() => { if (!disabled) setQuestionCount(n); }}
                    disabled={disabled}
                    aria-pressed={isActive}
                  >
                    <Hash size={11} />{n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start button */}
          {maxAvailable === 0 ? (
            <div className="qv-no-questions">
              Bu filtrdə hələ sual əlavə edilməyib.
            </div>
          ) : (
            <>
              {startError && (
                <div className="qv-no-questions">
                  {startError}
                </div>
              )}
              <button
                id="qv-start-quiz-btn"
                className="qv-btn-start"
                onClick={handleStart}
              >
                {effectiveCount} Sual ilə Başla <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="qv-page" style={cssVars}>
        <div className="qv-setup-wrap">
          <div className="qv-no-questions">
            Bu seçim üçün sual tapılmadı.
          </div>
          <button id="qv-restart-btn" className="qv-btn-start" onClick={handleRestart}>
            Geri qayıt
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: SCOREBOARD
  // ═══════════════════════════════════════════════════════════
  if (finished) {
    const grade = percent >= 80 ? '🏆' : percent >= 60 ? '🥈' : '📚';
    return (
      <div className="qv-page" style={cssVars}>
        <div className="qv-score-wrap">
          <div className="qv-score-glow" aria-hidden="true" />
          <div className="qv-score-card">
            <div className="qv-score-icon">{grade}</div>
            <h2 className="qv-score-title">Nəticəniz</h2>
            <div className="qv-score-big">
              <span className="qv-score-num">{score.correct}</span>
              <span className="qv-score-sep">/</span>
              <span className="qv-score-denom">{score.total}</span>
            </div>
            <div className="qv-score-pct">{percent}% Uğur</div>

            {score.byLevel.length > 1 && (
              <div className="qv-score-breakdown">
                {score.byLevel.map(({ lvl, correct: c, total: t }) => (
                  <div key={lvl} className="qv-score-row">
                    <span className="qv-score-lvl">{lvl}</span>
                    <span className="qv-score-bar-wrap">
                      <span className="qv-score-bar" style={{ width: `${t > 0 ? (c / t) * 100 : 0}%` }} />
                    </span>
                    <span className="qv-score-fraction">{c}/{t}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="qv-score-actions">
              <button id="qv-restart-btn" className="qv-btn-primary" onClick={handleRestart}>
                Yenidən Başla
              </button>
              <button id="qv-home-btn" className="qv-btn-ghost" onClick={onGoHome}>
                <Home size={15} /> Ana Səhifə
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: ACTIVE QUIZ
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="qv-page" style={cssVars}>
      <div className="qv-quiz-wrap">

        {/* ── Top bar ── */}
        <div className="qv-topbar">
          <div className="qv-cat-badge">
            <span>{category.icon}</span>
            <span>{category.title}</span>
          </div>
          <button id="qv-back-categories-active-btn" className="qv-topbar-back" onClick={onGoHome}>
            <Layers size={14} /> Biliklər
          </button>
          <div className="qv-progress-label">
            {currentIdx + 1} <span>/</span> {total}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="qv-progress-bar" role="progressbar" aria-valuenow={currentIdx + 1} aria-valuemax={total}>
          <div className="qv-progress-fill" style={{ width: `${((currentIdx + 1) / total) * 100}%` }} />
        </div>

        {/* ── Question ── */}
        <div className="qv-question-wrap" key={current.id}>
          <div className="qv-difficulty-badge" data-level={current.difficulty}>
            {current.difficulty}
          </div>
          <p className="qv-question-text">{current.question}</p>
        </div>

        {/* Fix 5: submit xətası */}
        {submitError && (
          <div className="qv-no-questions" style={{ marginBottom: '0.75rem' }}>
            {submitError}
          </div>
        )}

        {/* ── Options ── */}
        <div className="qv-options" role="list">
          {current.options.map(opt => {
            const isAnswered = selected !== null && !isSubmitting;
            const isCorrect  = opt.key === current.correctKey;
            const isSelected = opt.key === selected;

            let state = '';
            if (isAnswered) {
              if (isCorrect)       state = 'correct';
              else if (isSelected) state = 'wrong';
              else                 state = 'dim';
            }

            return (
              <div
                key={opt.key}
                id={`qv-opt-${opt.key}`}
                role="listitem"
                className={`qv-option ${state ? `qv-option--${state}` : ''} ${!isAnswered && !isSubmitting ? 'qv-option--interactive' : ''} ${isSubmitting && opt.key === selected ? 'qv-option--loading' : ''}`}
                onClick={() => handleSelect(opt.key)}
                tabIndex={isAnswered || isSubmitting ? -1 : 0}
                onKeyDown={e => { if (!isAnswered && !isSubmitting && (e.key === 'Enter' || e.key === ' ')) handleSelect(opt.key); }}
                aria-disabled={isAnswered || isSubmitting}
              >
                {/* Header */}
                <div className="qv-option-header">
                  <span className="qv-option-key">{opt.key}</span>
                  <span className="qv-option-text">{opt.text}</span>
                  {isAnswered && (
                    <span className="qv-option-icon" aria-hidden="true">
                      {isCorrect
                        ? <CheckCircle size={18} className="qv-icon-correct" />
                        : isSelected
                          ? <XCircle size={18} className="qv-icon-wrong" />
                          : <XCircle size={18} className="qv-icon-dim" />
                      }
                    </span>
                  )}
                </div>

                {/* Explanation — all 4 options revealed after answer */}
                {isAnswered && (
                  <div className="qv-explanation" aria-live="polite">
                    <span className="qv-explanation-label">
                      {isCorrect ? '✅ Mentor İzahı' : '📖 Niyə Yanlış?'}
                    </span>
                    <p className="qv-explanation-text">
                      {opt.explanation.startsWith('Düzgün cavab.') ? (
                        <>
                          <span className="qv-exp-prefix qv-exp-correct">Düzgün cavab</span>
                          {opt.explanation.substring('Düzgün cavab.'.length)}
                        </>
                      ) : opt.explanation.startsWith('Yanlış.') ? (
                        <>
                          <span className="qv-exp-prefix qv-exp-wrong">Yanlış</span>
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
          {/* Previous — always visible after first question, shows read-only answered state */}
          <button
            id="qv-prev-btn"
            className="qv-btn-ghost"
            onClick={handlePrev}
            disabled={currentIdx === 0}
            aria-label="Əvvəlki sual"
          >
            <ArrowLeft size={15} /> Əvvəlki
          </button>

          {/* Fix 2: isSubmitting tamamlanana qədər Next düyməsi gizlənir */}
          {selected !== null && !isSubmitting && (
            <button
              id="qv-next-btn"
              className="qv-btn-primary"
              onClick={handleNext}
              aria-label={currentIdx === total - 1 ? 'Nəticəni gör' : 'Növbəti sual'}
            >
              {currentIdx === total - 1
                ? <><Trophy size={15} /> Nəticəni Gör</>
                : <>Növbəti Sual <ArrowRight size={15} /></>
              }
            </button>
          )}
          {/* Fix 8: submit zamanı loading göstəricisi */}
          {isSubmitting && (
            <span className="qv-submitting">Yoxlanılır...</span>
          )}
        </div>
      </div>
    </div>
  );
}
