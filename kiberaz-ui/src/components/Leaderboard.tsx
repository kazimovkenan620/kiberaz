import { useState, useEffect } from 'react';
import { Minus, Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import {
  fetchLeaderboard,
  fetchQuizCategories,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../services/quizService';
import { Badge, EmptyState, SkeletonList, Tabs } from './ui';
import './Leaderboard.css';

// ─── Liderlik lövhəsi ─────────────────────────────────────────
// Məxfilik: yalnız ləqəb (`name`) və ictimai statistika (`username`) göstərilir —
// server ad/soyad, e-poçt və ya identifikator göndərmir və UI onları gözləmir.

// UI-dakı etiket ilə API parametri ayrı saxlanılır — göstərilən mətn dəyişsə də sorğu sınmır.
const timePeriods: { label: string; value: LeaderboardPeriod }[] = [
  { label: 'Həftəlik', value: 'weekly' },
  { label: 'Aylıq', value: 'monthly' },
  { label: 'Ümumi', value: 'all' },
];

type CategoryFilter = { id: number | null; title: string };

// id === null → filtr yoxdur, bütün kateqoriyalar.
const ALL_CATEGORIES: CategoryFilter = { id: null, title: 'Hamısı' };

function ChangeCell({ change, value }: { change: string; value: number }) {
  if (change === 'up') return <span className="lb-change lb-change--up" aria-label={`${value} yuxarı`}><TrendingUp size={13} /> +{value}</span>;
  if (change === 'down') return <span className="lb-change lb-change--down" aria-label={`${value} aşağı`}><TrendingDown size={13} /> -{value}</span>;
  return <span className="lb-change" aria-label="Dəyişim yoxdur"><Minus size={13} /> —</span>;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardPeriod>('weekly');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(ALL_CATEGORIES);
  const [categories, setCategories] = useState<CategoryFilter[]>([ALL_CATEGORIES]);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  // Kateqoriya filtrləri artıq sabit siyahı deyil — bazadakı real kateqoriyalardan qurulur.
  useEffect(() => {
    fetchQuizCategories()
      .then(cats => setCategories([ALL_CATEGORIES, ...cats.map(c => ({ id: c.id, title: c.title }))]))
      .catch(() => undefined);
  }, []);

  // Hər filtr dəyişikliyində lövhə yenidən yüklənir. `entries === null` yüklənmə deməkdir;
  // sinxron setState olmadan skelet göstərmək üçün sorğu mikrotaskda başlayır.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setEntries(null); });
    fetchLeaderboard(activeTab, activeCategory.id, 10)
      .then(data => { if (!cancelled) setEntries(data); });

    // Sürətlə filtr dəyişdirildikdə köhnə sorğunun cavabı yenisini əzməsin deyə.
    return () => { cancelled = true; };
  }, [activeTab, activeCategory]);

  const loading = entries === null;

  return (
    <section id="leaderboard" className="lb page-section" aria-labelledby="leaderboard-section-title">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="kicker">Rəqabət</div>
            <h2 id="leaderboard-section-title">Liderlik lövhəsi</h2>
            <p>Həftəlik, aylıq və ümumi reytinqlər. Yalnız ləqəb göstərilir; xal çətinlik səviyyəsinə görə hesablanır.</p>
          </div>
          <Tabs
            variant="pills"
            idPrefix="lb-tab"
            ariaLabel="Zaman dövrü"
            items={timePeriods.map(p => ({ id: p.value, label: p.label }))}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="lb__filters" role="group" aria-label="Kateqoriya filtrləri">
          {categories.map(cat => (
            <button
              key={cat.id ?? 'all'}
              id={`lb-filter-${cat.title.replace(/\s/g, '-').toLowerCase()}`}
              type="button"
              className="segmented__btn lb__filter"
              aria-pressed={activeCategory.id === cat.id}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.title}
            </button>
          ))}
        </div>

        <div className="card lb__card">
          {loading && <div className="card--pad"><SkeletonList rows={5} /></div>}

          {!loading && entries.length === 0 && (
            <EmptyState
              icon={<Trophy size={20} />}
              title="Bu filtr üzrə hələ nəticə yoxdur"
              text="İlk testi həll edən ilk lider olacaq."
            />
          )}

          {!loading && entries.length > 0 && (
            <div className="table-wrap">
              <table className="table lb-table" aria-label="Lider cədvəli">
                <thead>
                  <tr>
                    <th className="lb-col-rank">#</th>
                    <th>İstifadəçi</th>
                    <th className="lb-col-category">Kateqoriya</th>
                    <th className="is-num">Xal</th>
                    <th className="lb-col-change">Dəyişim</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const top = entry.rank <= 3;
                    return (
                      <tr key={entry.rank} id={`lb-row-${entry.rank}`} className={top ? 'lb-row--top' : undefined}>
                        <td className="lb-col-rank">
                          <span className={`lb-rank${top ? ` lb-rank--${entry.rank}` : ''}`} aria-label={`Sıra: ${entry.rank}`}>{entry.rank}</span>
                        </td>
                        <td>
                          <div className="lb-user">
                            <span className={`avatar avatar--sm${top ? ' avatar--brand' : ''}`} aria-hidden="true">{entry.avatar}</span>
                            <div className="lb-user__info">
                              <span className="cell-main">{entry.name}</span>
                              <span className="cell-sub">{entry.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="lb-col-category"><Badge>{entry.category}</Badge></td>
                        <td className="is-num lb-score">{entry.score.toLocaleString('az-AZ')}</td>
                        <td className="lb-col-change"><ChangeCell change={entry.change} value={entry.changeValue} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
