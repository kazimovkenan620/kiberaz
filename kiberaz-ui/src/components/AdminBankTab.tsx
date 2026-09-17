import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Edit3, Layers, ListChecks, Lock, Plus, RefreshCw, RotateCcw, Trash2, Unlock,
} from 'lucide-react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  createQuizCategory, createQuizQuestion, deleteQuizCategory, deleteQuizQuestion,
  getAdminCategories, getAdminQuestions, restoreQuizCategory, restoreQuizQuestion, updateQuizCategory, updateQuizQuestion,
  type AdminQuizCategory, type AdminQuizQuestion, type CreateQuestionRequest, type QuizCategoryRequest,
} from '../services/adminService';
import { categoryIcon } from '../utils/categoryIcon';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FormField, Modal, SearchField, SkeletonList,
  StatCard, Tabs,
} from './ui';
import './AdminBankTab.css';

// ─── Admin · Kateqoriyalar + suallar (sual bankı) ─────────────
// İki bank var: AÇIQ suallar ana səhifədəki quizdə görünür, MƏXFİ suallar yalnız imtahan
// sessiyalarında işlənir. Sualın bankı yalnız YARADILARKƏN seçilir — server düzəlişdə bankı
// dəyişməyə icazə vermir, çünki bir dəfə açıq göstərilmiş sual imtahana yaramır.

type ToastFn = (msg: string, type: 'success' | 'error') => void;
type BankTab = 'categories' | 'questions';

const DIFFICULTIES = ['Başlanğıc', 'Orta', 'Peşəkar'];
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const ICON_CHOICES = ['🔌', '🕸️', '🏢', '📊', '💻', '💼', '🌐', '⚔️', '🛡️', '📚'];
const COLOR_CHOICES = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
const PAGE_SIZE = 25;

const formatDay = (iso?: string | null) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—';

const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  'Başlanğıc': 'success', 'Orta': 'warning', 'Peşəkar': 'danger',
};

const emptyCategory = (): QuizCategoryRequest => ({
  title: '', icon: ICON_CHOICES[0], description: '', color: COLOR_CHOICES[0], topics: [], sortOrder: 0,
});

const emptyQuestion = (categoryId: number): CreateQuestionRequest => ({
  categoryId, difficulty: 'Başlanğıc', question: '', correctKey: 'A', isExamOnly: false,
  options: OPTION_KEYS.map(key => ({ key, text: '', explanation: '' })),
});

// ── Kateqoriya forması ───────────────────────────────────────
function CategoryModal({ initial, onClose, onSubmit }: {
  initial: AdminQuizCategory | null;
  onClose: () => void;
  onSubmit: (body: QuizCategoryRequest) => Promise<{ success: boolean; message: string; errors?: string[] }>;
}) {
  const [form, setForm] = useState<QuizCategoryRequest>(() => initial
    ? { title: initial.title, icon: initial.icon, description: initial.description, color: initial.color, topics: [...initial.topics], sortOrder: initial.sortOrder }
    : emptyCategory());
  const [topicsText, setTopicsText] = useState(() => (initial?.topics ?? []).join('\n'));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof QuizCategoryRequest>(key: K, value: QuizCategoryRequest[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setErrors([]);
    try {
      const body: QuizCategoryRequest = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        topics: topicsText.split('\n').map(t => t.trim()).filter(Boolean),
      };
      const res = await onSubmit(body);
      if (!res.success) setErrors(res.errors?.length ? res.errors : [res.message || 'Xəta baş verdi.']);
    } catch { setErrors(['Serverlə əlaqə yaradıla bilmədi.']); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={initial ? 'Kateqoriyanı redaktə et' : 'Yeni kateqoriya'} kicker="Sual bankı" size="md">
      <form className="bank-form" onSubmit={submit}>
        <div className="form-grid form-grid--2">
          <FormField id="bank-cat-title" label="Başlıq" required>
            <input id="bank-cat-title" className="input" value={form.title} onChange={e => set('title', e.target.value)} maxLength={80} required placeholder="Web Security" />
          </FormField>
          <FormField id="bank-cat-order" label="Sıra nömrəsi" hint="Kiçik rəqəm siyahıda önə gəlir (0–100)">
            <input id="bank-cat-order" className="input" type="number" min={0} max={100} value={form.sortOrder}
              onChange={e => set('sortOrder', Number(e.target.value))} />
          </FormField>
        </div>

        <FormField id="bank-cat-desc" label="Açıqlama" required hint="Minimum 10 simvol">
          <textarea id="bank-cat-desc" className="textarea" rows={2} value={form.description}
            onChange={e => set('description', e.target.value)} maxLength={300} required placeholder="Bu kateqoriyada nə öyrənilir?" />
        </FormField>

        <fieldset className="bank-fieldset">
          <legend className="field__label">İkon</legend>
          <div className="bank-choices" role="group" aria-label="İkon seçimi">
            {ICON_CHOICES.map(icon => (
              <button key={icon} type="button" className={`bank-choice${form.icon === icon ? ' is-active' : ''}`}
                aria-pressed={form.icon === icon} onClick={() => set('icon', icon)}>
                <span aria-hidden="true">{icon}</span>
              </button>
            ))}
            <input className="input input--sm bank-choice-input" value={form.icon} onChange={e => set('icon', e.target.value)}
              maxLength={16} aria-label="İkon (emoji)" />
          </div>
        </fieldset>

        <fieldset className="bank-fieldset">
          <legend className="field__label">Rəng</legend>
          <div className="bank-choices" role="group" aria-label="Rəng seçimi">
            {COLOR_CHOICES.map(color => (
              <button key={color} type="button" className={`bank-swatch${form.color === color ? ' is-active' : ''}`}
                style={{ background: color }} aria-pressed={form.color === color} aria-label={`Rəng ${color}`}
                onClick={() => set('color', color)} />
            ))}
            <input className="input input--sm bank-choice-input" value={form.color} onChange={e => set('color', e.target.value)}
              maxLength={7} pattern="#[0-9a-fA-F]{6}" title="#RRGGBB" aria-label="Rəng kodu (#RRGGBB)" />
          </div>
        </fieldset>

        <FormField id="bank-cat-topics" label="Mövzular" hint="Hər sətirdə bir mövzu (ən çox 20)">
          <textarea id="bank-cat-topics" className="textarea" rows={4} value={topicsText}
            onChange={e => setTopicsText(e.target.value)} placeholder={'TCP/IP\nARP\nDNS'} />
        </FormField>

        {errors.length > 0 && (
          <div className="notice notice--danger" role="alert"><ul>{errors.map((msg, i) => <li key={i}>{msg}</li>)}</ul></div>
        )}

        <div className="modal__actions">
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button type="submit" variant="primary" loading={loading}>{initial ? 'Yadda saxla' : 'Əlavə et'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Sual forması ─────────────────────────────────────────────
function QuestionModal({ initial, categories, onClose, onSubmit }: {
  initial: AdminQuizQuestion | null;
  categories: AdminQuizCategory[];
  onClose: () => void;
  onSubmit: (body: CreateQuestionRequest) => Promise<{ success: boolean; message: string; errors?: string[] }>;
}) {
  const [form, setForm] = useState<CreateQuestionRequest>(() => initial
    ? {
        categoryId: initial.categoryId, difficulty: initial.difficulty, question: initial.question,
        correctKey: initial.correctKey, isExamOnly: initial.isExamOnly,
        options: OPTION_KEYS.map(key => {
          const found = initial.options.find(o => o.key === key);
          return { key, text: found?.text ?? '', explanation: found?.explanation ?? '' };
        }),
      }
    : emptyQuestion(categories[0]?.id ?? 0));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const setOption = (key: string, field: 'text' | 'explanation', value: string) =>
    setForm(current => ({ ...current, options: current.options.map(o => o.key === key ? { ...o, [field]: value } : o) }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setErrors([]);
    try {
      const res = await onSubmit({
        ...form,
        question: form.question.trim(),
        options: form.options.map(o => ({ ...o, text: o.text.trim(), explanation: o.explanation.trim() })),
      });
      if (!res.success) setErrors(res.errors?.length ? res.errors : [res.message || 'Xəta baş verdi.']);
    } catch { setErrors(['Serverlə əlaqə yaradıla bilmədi.']); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={initial ? 'Sualı redaktə et' : 'Yeni sual'} kicker="Sual bankı" size="lg">
      <form className="bank-form" onSubmit={submit}>
        <div className="form-grid form-grid--3">
          <FormField id="bank-q-cat" label="Kateqoriya" required>
            <select id="bank-q-cat" className="select" value={form.categoryId} required
              onChange={e => setForm(c => ({ ...c, categoryId: Number(e.target.value) }))}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </FormField>
          <FormField id="bank-q-diff" label="Çətinlik" required>
            <select id="bank-q-diff" className="select" value={form.difficulty} required
              onChange={e => setForm(c => ({ ...c, difficulty: e.target.value }))}>
              {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField id="bank-q-bank" label="Bank"
            hint={initial ? 'Mövcud sualın bankı dəyişdirilmir' : 'Məxfi sual ana səhifədə görünmür'}>
            <select id="bank-q-bank" className="select" value={form.isExamOnly ? 'exam' : 'public'} disabled={Boolean(initial)}
              onChange={e => setForm(c => ({ ...c, isExamOnly: e.target.value === 'exam' }))}>
              <option value="public">Açıq (quiz)</option>
              <option value="exam">Məxfi (imtahan)</option>
            </select>
          </FormField>
        </div>

        <FormField id="bank-q-text" label="Sual mətni" required hint="10–500 simvol">
          <textarea id="bank-q-text" className="textarea" rows={3} value={form.question} required maxLength={500}
            onChange={e => setForm(c => ({ ...c, question: e.target.value }))} placeholder="ARP hücumunun əsas məqsədi nədir?" />
        </FormField>

        <fieldset className="bank-fieldset">
          <legend className="field__label">Cavab variantları — düzgün olanı seçin</legend>
          <div className="bank-options">
            {form.options.map(option => (
              <div key={option.key} className={`bank-option${form.correctKey === option.key ? ' is-correct' : ''}`}>
                <label className="bank-option__key">
                  <input type="radio" name="bank-correct" value={option.key} checked={form.correctKey === option.key}
                    onChange={() => setForm(c => ({ ...c, correctKey: option.key }))} />
                  <span aria-hidden="true">{option.key}</span>
                  <span className="visually-hidden">{option.key} variantını düzgün seç</span>
                </label>
                <div className="bank-option__fields">
                  <input className="input" value={option.text} required maxLength={300} aria-label={`${option.key} variantının mətni`}
                    onChange={e => setOption(option.key, 'text', e.target.value)} placeholder={`${option.key} variantı`} />
                  <textarea className="textarea" rows={2} value={option.explanation} required maxLength={1000}
                    aria-label={`${option.key} variantının izahı`} placeholder="İzah: niyə doğru / yanlışdır"
                    onChange={e => setOption(option.key, 'explanation', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        {errors.length > 0 && (
          <div className="notice notice--danger" role="alert"><ul>{errors.map((msg, i) => <li key={i}>{msg}</li>)}</ul></div>
        )}

        <div className="modal__actions">
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button type="submit" variant="primary" loading={loading} disabled={categories.length === 0}>
            {initial ? 'Yadda saxla' : 'Sualı əlavə et'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Əsas bölmə ───────────────────────────────────────────────
export default function AdminBankTab({ onToast }: { onToast: ToastFn }) {
  const [tab, setTab] = useState<BankTab>('categories');
  // "Silinmişlər" rejimi: siyahılar yalnız soft-delete olunmuş sətirləri göstərir, əməliyyat "Bərpa et"dir.
  const [showDeleted, setShowDeleted] = useState(false);

  // Aktiv kateqoriyalar hər iki alt-bölmədə lazımdır (sual formasındakı seçim və filtr buradan gəlir).
  const categoriesLoader = useCallback(async () => {
    const res = await getAdminCategories(false);
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'Kateqoriyalar yüklənmədi.');
    return res.data;
  }, []);
  const { state: catState, reload: reloadCategories } = useAsyncData(categoriesLoader);
  const categories = catState.status === 'ready' ? catState.data : [];

  // Silinmiş kateqoriyalar yalnız rejim açılanda çəkilir.
  const deletedLoader = useCallback(async () => {
    if (!showDeleted) return [] as AdminQuizCategory[];
    const res = await getAdminCategories(true);
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'Silinmiş kateqoriyalar yüklənmədi.');
    return res.data;
  }, [showDeleted]);
  const { state: delState, reload: reloadDeleted } = useAsyncData(deletedLoader);
  const deletedCategories = delState.status === 'ready' ? delState.data : [];
  const listedCategories = showDeleted ? deletedCategories : categories;
  const listState = showDeleted ? delState : catState;

  const [catModal, setCatModal] = useState<{ open: boolean; initial: AdminQuizCategory | null } | null>(null);
  const [catDelete, setCatDelete] = useState<AdminQuizCategory | null>(null);

  // ── Suallar: filtr + səhifələmə ──
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState('');
  const [bank, setBank] = useState<'' | 'public' | 'exam'>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [qModal, setQModal] = useState<{ open: boolean; initial: AdminQuizQuestion | null } | null>(null);
  const [qDelete, setQDelete] = useState<AdminQuizQuestion | null>(null);
  const [busy, setBusy] = useState(false);

  // Yazarkən hər hərfdə sorğu getməsin deyə 350 ms gecikmə.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search); setPage(0); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const questionsLoader = useCallback(async () => {
    const res = await getAdminQuestions({
      categoryId, search: query, difficulty: difficulty || undefined,
      examOnly: bank === '' ? null : bank === 'exam',
      deleted: showDeleted,
      skip: page * PAGE_SIZE, take: PAGE_SIZE,
    });
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'Suallar yüklənmədi.');
    return res.data;
  }, [categoryId, query, difficulty, bank, page, showDeleted]);
  const { state: qState, reload: reloadQuestions } = useAsyncData(questionsLoader);
  const questions = qState.status === 'ready' ? qState.data.items : [];
  const total = qState.status === 'ready' ? qState.data.total : 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const run = async (action: () => Promise<{ success: boolean; message: string; errors?: string[] }>, after: () => void) => {
    if (busy) return { success: false, message: 'Gözləyin...' };
    setBusy(true);
    try {
      const res = await action();
      if (res.success) { onToast(res.message || 'Əməliyyat tamamlandı.', 'success'); after(); }
      return res;
    } finally { setBusy(false); }
  };

  // Bərpa modalsız çağırılır — serverin rədd səbəbi (məs. "əvvəlcə kateqoriyanı bərpa edin") toast ilə göstərilir.
  const restore = async (action: () => Promise<{ success: boolean; message: string; errors?: string[] }>, after: () => void) => {
    const res = await run(action, after);
    if (!res.success) onToast(res.errors?.[0] || res.message || 'Bərpa mümkün olmadı.', 'error');
  };

  const totals = {
    categories: categories.length,
    questions: categories.reduce((sum, c) => sum + c.totalQuestionCount, 0),
    exam: categories.reduce((sum, c) => sum + c.examQuestionCount, 0),
    open: categories.reduce((sum, c) => sum + c.publicQuestionCount, 0),
  };

  return (
    <div className="adm">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">İdarəetmə paneli</span>
          <h1 className="page-header__title">Kateqoriyalar və suallar</h1>
          <p className="page-header__lead">Sual bankının idarəsi. <strong>Açıq</strong> suallar ana səhifədəki quizdə görünür, <strong>məxfi</strong> suallar isə yalnız imtahan sessiyalarında işlənir.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { reloadCategories(); reloadDeleted(); reloadQuestions(); }} aria-label="Siyahıları yenilə">
          <RefreshCw size={14} />
        </Button>
      </div>

      <div className="stat-grid adm-stats">
        <StatCard icon={<Layers size={18} />} tone="brand" value={totals.categories} label="Kateqoriya" />
        <StatCard icon={<ListChecks size={18} />} tone="info" value={totals.questions} label="Ümumi sual" />
        <StatCard icon={<Unlock size={18} />} tone="success" value={totals.open} label="Açıq sual" />
        <StatCard icon={<Lock size={18} />} tone="warning" value={totals.exam} label="Məxfi (imtahan) sual" />
      </div>

      <Card padded={false} className="adm-table-card">
        <div className="adm-toolbar">
          <Tabs
            idPrefix="adm-bank"
            ariaLabel="Sual bankı bölmələri"
            items={[
              { id: 'categories' as BankTab, label: 'Kateqoriyalar', count: totals.categories },
              { id: 'questions' as BankTab, label: 'Suallar', count: total },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="adm-toolbar__right">
            <label className="adm-switch">
              <input type="checkbox" checked={showDeleted} onChange={e => { setShowDeleted(e.target.checked); setPage(0); }} />
              <span>Silinmişlər</span>
            </label>
            {tab === 'categories'
              ? <Button variant="primary" size="sm" disabled={showDeleted} onClick={() => setCatModal({ open: true, initial: null })}><Plus size={14} /> Yeni kateqoriya</Button>
              : <Button variant="primary" size="sm" disabled={showDeleted || categories.length === 0} onClick={() => setQModal({ open: true, initial: null })}><Plus size={14} /> Yeni sual</Button>}
          </div>
        </div>

        {/* ═══ KATEQORİYALAR ═══ */}
        {tab === 'categories' && (
          <>
            {listState.status === 'loading' && <div className="card--pad"><SkeletonList rows={4} /></div>}
            {listState.status === 'error' && <ErrorState title="Kateqoriyalar yüklənmədi" text={listState.message} onRetry={() => { reloadCategories(); reloadDeleted(); }} />}
            {listState.status === 'ready' && listedCategories.length === 0 && (
              showDeleted
                ? <EmptyState icon={<RotateCcw size={20} />} title="Silinmiş kateqoriya yoxdur" text="Silinən kateqoriyalar burada görünür və bərpa edilə bilər." />
                : <EmptyState icon={<Layers size={20} />} title="Kateqoriya yoxdur" text="İlk kateqoriyanı əlavə edin — suallar ona bağlanacaq." />
            )}
            {listState.status === 'ready' && listedCategories.length > 0 && (
              <div className="table-wrap">
                <table className="table adm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Kateqoriya</th>
                      <th>Mövzular</th>
                      <th className="is-num">Açıq</th>
                      <th className="is-num">Məxfi</th>
                      <th className="is-num">İştirakçı</th>
                      <th className="is-num">{showDeleted ? 'Silinib' : 'Sıra'}</th>
                      <th className="cell-actions">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listedCategories.map(category => (
                      <tr key={category.id}>
                        <td className="cell-mono">{category.id}</td>
                        <td>
                          <div className="bank-cat">
                            <span className="bank-cat__icon" style={{ color: category.color }} aria-hidden="true">{categoryIcon(category.icon, 16)}</span>
                            <div className="adm-user__text">
                              <span className="cell-main">{category.title}</span>
                              <span className="cell-sub">{category.description}</span>
                            </div>
                          </div>
                        </td>
                        <td className="cell-muted">{category.topics.length}</td>
                        <td className="is-num"><Badge tone="success">{category.publicQuestionCount}</Badge></td>
                        <td className="is-num"><Badge tone="warning">{category.examQuestionCount}</Badge></td>
                        <td className="is-num">{category.participantCount}</td>
                        <td className="is-num cell-mono">{showDeleted ? formatDay(category.deletedAt) : category.sortOrder}</td>
                        <td>
                          <div className="cell-actions">
                            {showDeleted ? (
                              <Button variant="success" size="sm" disabled={busy}
                                onClick={() => void restore(() => restoreQuizCategory(category.id) as Promise<{ success: boolean; message: string; errors?: string[] }>,
                                  () => { reloadDeleted(); reloadCategories(); reloadQuestions(); })}>
                                <RotateCcw size={13} /> Bərpa et
                              </Button>
                            ) : (
                              <>
                                <Button variant="outline" size="sm" onClick={() => setCatModal({ open: true, initial: category })}><Edit3 size={13} /> Redaktə</Button>
                                <Button variant="danger" size="sm" onClick={() => setCatDelete(category)} disabled={busy} aria-label={`${category.title} kateqoriyasını sil`}><Trash2 size={13} /> Sil</Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══ SUALLAR ═══ */}
        {tab === 'questions' && (
          <>
            <div className="bank-filters">
              <label className="visually-hidden" htmlFor="bank-filter-cat">Kateqoriya filtri</label>
              <select id="bank-filter-cat" className="select input--sm" value={categoryId ?? ''}
                onChange={e => { setCategoryId(e.target.value ? Number(e.target.value) : null); setPage(0); }}>
                <option value="">Bütün kateqoriyalar</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>

              <label className="visually-hidden" htmlFor="bank-filter-diff">Çətinlik filtri</label>
              <select id="bank-filter-diff" className="select input--sm" value={difficulty}
                onChange={e => { setDifficulty(e.target.value); setPage(0); }}>
                <option value="">Bütün çətinliklər</option>
                {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>

              <label className="visually-hidden" htmlFor="bank-filter-bank">Bank filtri</label>
              <select id="bank-filter-bank" className="select input--sm" value={bank}
                onChange={e => { setBank(e.target.value as '' | 'public' | 'exam'); setPage(0); }}>
                <option value="">Hər iki bank</option>
                <option value="public">Açıq (quiz)</option>
                <option value="exam">Məxfi (imtahan)</option>
              </select>

              <SearchField value={search} onChange={setSearch} label="Sual axtar" placeholder="Sual mətnində axtar..." size="sm" className="adm-search" />
            </div>

            {qState.status === 'loading' && <div className="card--pad"><SkeletonList rows={5} /></div>}
            {qState.status === 'error' && <ErrorState title="Suallar yüklənmədi" text={qState.message} onRetry={reloadQuestions} />}
            {qState.status === 'ready' && questions.length === 0 && (
              <EmptyState icon={showDeleted ? <RotateCcw size={20} /> : <ListChecks size={20} />} title={showDeleted ? 'Silinmiş sual yoxdur' : 'Sual tapılmadı'}
                text={query || categoryId || difficulty || bank ? 'Filtrləri dəyişin.' : showDeleted ? 'Silinən suallar burada görünür və bərpa edilə bilər.' : 'Bu bankda hələ sual yoxdur.'} />
            )}
            {qState.status === 'ready' && questions.length > 0 && (
              <>
                <div className="table-wrap">
                  <table className="table adm-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Sual</th>
                        <th>Kateqoriya</th>
                        <th>Çətinlik</th>
                        <th>Bank</th>
                        <th className="is-num">Cavab</th>
                        <th className="cell-actions">Əməliyyat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map(question => (
                        <tr key={question.id}>
                          <td className="cell-mono">{question.id}</td>
                          <td>
                            <div className="adm-user__text">
                              <span className="cell-main bank-question">{question.question}</span>
                              <span className="cell-sub">Düzgün: <strong>{question.correctKey}</strong> · {question.options.find(o => o.key === question.correctKey)?.text ?? '—'}</span>
                            </div>
                          </td>
                          <td className="cell-muted"><span className="bank-cat-title">{question.categoryTitle}</span></td>
                          <td><Badge tone={DIFFICULTY_TONE[question.difficulty] ?? 'neutral'}>{question.difficulty}</Badge></td>
                          <td>{question.isExamOnly
                            ? <Badge tone="warning"><Lock size={11} /> Məxfi</Badge>
                            : <Badge tone="success"><Unlock size={11} /> Açıq</Badge>}</td>
                          <td className="is-num">{question.answerCount}</td>
                          <td>
                            <div className="cell-actions">
                              {showDeleted ? (
                                <Button variant="success" size="sm" disabled={busy} title={question.deletedAt ? `Silinib: ${formatDay(question.deletedAt)}` : undefined}
                                  onClick={() => void restore(() => restoreQuizQuestion(question.id) as Promise<{ success: boolean; message: string; errors?: string[] }>,
                                    () => { reloadQuestions(); reloadCategories(); })}>
                                  <RotateCcw size={13} /> Bərpa et
                                </Button>
                              ) : (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => setQModal({ open: true, initial: question })}><Edit3 size={13} /> Redaktə</Button>
                                  <Button variant="danger" size="sm" onClick={() => setQDelete(question)} disabled={busy} aria-label={`${question.id} nömrəli sualı sil`}><Trash2 size={13} /> Sil</Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bank-pager">
                  <span className="text-3 text-sm">{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} / {total} sual</span>
                  <div className="bank-pager__buttons">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft size={14} /> Əvvəlki</Button>
                    <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => Math.min(lastPage, p + 1))}>Növbəti <ChevronRight size={14} /></Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      {catModal?.open && (
        <CategoryModal
          initial={catModal.initial}
          onClose={() => setCatModal(null)}
          onSubmit={async body => {
            const res = await run(
              () => catModal.initial ? updateQuizCategory(catModal.initial.id, body) as Promise<{ success: boolean; message: string; errors?: string[] }> : createQuizCategory(body) as Promise<{ success: boolean; message: string; errors?: string[] }>,
              () => { setCatModal(null); reloadCategories(); reloadQuestions(); },
            );
            return res;
          }}
        />
      )}

      {qModal?.open && (
        <QuestionModal
          initial={qModal.initial}
          categories={categories}
          onClose={() => setQModal(null)}
          onSubmit={async body => {
            const res = await run(
              () => qModal.initial
                ? updateQuizQuestion(qModal.initial.id, { categoryId: body.categoryId, difficulty: body.difficulty, question: body.question, correctKey: body.correctKey, options: body.options }) as Promise<{ success: boolean; message: string; errors?: string[] }>
                : createQuizQuestion(body) as Promise<{ success: boolean; message: string; errors?: string[] }>,
              () => { setQModal(null); reloadQuestions(); reloadCategories(); },
            );
            return res;
          }}
        />
      )}

      <ConfirmDialog
        open={catDelete !== null}
        title="Kateqoriyanı silmək istəyirsiniz?"
        confirmLabel="Bəli, sil"
        icon={<Trash2 size={14} />}
        busy={busy}
        onCancel={() => { if (!busy) setCatDelete(null); }}
        onConfirm={() => {
          if (!catDelete) return;
          void run(() => deleteQuizCategory(catDelete.id) as Promise<{ success: boolean; message: string; errors?: string[] }>,
            () => { setCatDelete(null); reloadCategories(); reloadQuestions(); });
        }}
      >
        {catDelete && (
          <>
            <strong>«{catDelete.title}»</strong> kateqoriyası ilə birlikdə <strong>{catDelete.totalQuestionCount} sual</strong> da
            gizlədiləcək (silinmiş sayılacaq). Cavab tarixçəsi qalır, lakin suallar nə quizdə, nə də yeni imtahanlarda görünməyəcək.
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={qDelete !== null}
        title="Sualı silmək istəyirsiniz?"
        confirmLabel="Bəli, sil"
        icon={<Trash2 size={14} />}
        busy={busy}
        onCancel={() => { if (!busy) setQDelete(null); }}
        onConfirm={() => {
          if (!qDelete) return;
          void run(() => deleteQuizQuestion(qDelete.id) as Promise<{ success: boolean; message: string; errors?: string[] }>,
            () => { setQDelete(null); reloadQuestions(); reloadCategories(); });
        }}
      >
        {qDelete && (
          <>
            <span className="bank-question">«{qDelete.question}»</span> silinəcək.
            {qDelete.answerCount > 0 && <> Bu suala <strong>{qDelete.answerCount} cavab</strong> verilib — cavab tarixçəsi qalır, sual isə yeni testlərdə çıxmayacaq.</>}
          </>
        )}
      </ConfirmDialog>

      {categories.length === 0 && tab === 'questions' && (
        <div className="notice notice--warning" role="status">
          <AlertTriangle size={16} />
          <span>Sual əlavə etmək üçün əvvəlcə ən azı bir kateqoriya yaradın.</span>
        </div>
      )}
    </div>
  );
}
