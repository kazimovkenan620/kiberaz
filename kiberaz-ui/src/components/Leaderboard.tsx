import { useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { leaderboardData } from '../data/mockData';
import './Leaderboard.css';

const categories = ['Hamısı', 'Web Security', 'Network', 'SOC', 'Active Directory', 'Code Review'];
const timePeriods = ['Həftəlik', 'Aylıq', 'Ümumi'];

// Gradient palettes for avatars (by rank % 5)
const avatarGradients = [
  'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  'linear-gradient(135deg, #10b981, #3b82f6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
];

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('Həftəlik');
  const [activeCategory, setActiveCategory] = useState('Hamısı');

  const topThree = leaderboardData.slice(0, 3);
  const rest = leaderboardData.slice(3);

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const ChangeIcon = ({ change, value }: { change: string; value: number }) => {
    if (change === 'up')   return <><TrendingUp size={12} /> +{value}</>;
    if (change === 'down') return <><TrendingDown size={12} /> -{value}</>;
    return <><Minus size={12} /> —</>;
  };

  return (
    <section
      id="leaderboard"
      className="leaderboard-section"
      aria-labelledby="leaderboard-section-title"
    >
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <div className="section-tag">
            <Trophy size={14} />
            Rəqabət
          </div>
          <h2 className="section-title" id="leaderboard-section-title">
            Liderlər <span className="gradient-text">Lövhəsi</span>
          </h2>
          <p className="section-description">
            Ən yaxşı tələbələr arasında özünüzü sınayın. Həftəlik, aylıq və ümumi
            reytinqlər ilə irəliləyişinizi izləyin.
          </p>
        </div>

        {/* Controls */}
        <div className="leaderboard-controls">
          {/* Time Tabs */}
          <div className="leaderboard-tabs" role="tablist" aria-label="Zaman dövrü">
            {timePeriods.map((period) => (
              <button
                key={period}
                id={`lb-tab-${period}`}
                className={`leaderboard-tab ${activeTab === period ? 'active' : ''}`}
                onClick={() => setActiveTab(period)}
                role="tab"
                aria-selected={activeTab === period}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Category Filters */}
          <div className="leaderboard-filter" role="group" aria-label="Kateqoriya filtrləri">
            {categories.map((cat) => (
              <button
                key={cat}
                id={`lb-filter-${cat.replace(/\s/g, '-').toLowerCase()}`}
                className={`leaderboard-filter-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Top 3 Podium ── */}
        <div className="leaderboard-podium" aria-label="İlk üç lider">
          {/* Rearrange: 2nd, 1st, 3rd */}
          {[topThree[1], topThree[0], topThree[2]].map((entry, i) => {
            if (!entry) return null;
            const displayRank = [2, 1, 3][i];
            const badgeClass = ['silver', 'gold', 'bronze'][i];
            const avatarClass = ['silver', 'gold', 'bronze'][i];

            return (
              <div
                key={entry.rank}
                id={`podium-card-${entry.rank}`}
                className={`podium-card ${badgeClass}`}
                aria-label={`${displayRank}. yer: ${entry.name}, ${entry.score} xal`}
              >
                <span className="podium-rank-badge" aria-hidden="true">
                  {getMedalEmoji(displayRank)}
                </span>

                <div className={`podium-avatar ${avatarClass}`} aria-hidden="true">
                  {entry.avatar}
                </div>

                <div>
                  <div className="podium-name">{entry.name}</div>
                  <div className="podium-username">{entry.username}</div>
                </div>

                <div>
                  <div className="podium-score">
                    {entry.score.toLocaleString()}
                  </div>
                  <div className="podium-score-label">xal</div>
                </div>

                <span
                  className="badge"
                  style={{ background: 'var(--neutral-100)', color: 'var(--text-secondary)' }}
                >
                  {entry.category}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Full Leaderboard Table ── */}
        <div className="leaderboard-table" role="table" aria-label="Lider cədvəli">
          {/* Table Header */}
          <div className="leaderboard-table-header" role="row">
            <div role="columnheader">#</div>
            <div role="columnheader">İstifadəçi</div>
            <div role="columnheader" className="lb-col-category">Kateqoriya</div>
            <div role="columnheader">Xal</div>
            <div role="columnheader">Dəyişim</div>
          </div>

          {/* Table Rows (rank 4-7) */}
          {rest.map((entry, i) => (
            <div
              key={entry.rank}
              id={`lb-row-${entry.rank}`}
              className="leaderboard-row"
              role="row"
              aria-label={`${entry.rank}. yer: ${entry.name}`}
            >
              {/* Rank */}
              <div className="lb-rank" role="cell" aria-label={`Sıra: ${entry.rank}`}>
                {entry.rank}
              </div>

              {/* User */}
              <div className="lb-user" role="cell">
                <div
                  className="lb-avatar"
                  aria-hidden="true"
                  style={{ background: avatarGradients[(i + 3) % avatarGradients.length] }}
                >
                  {entry.avatar}
                </div>
                <div className="lb-user-info">
                  <div className="lb-name">{entry.name}</div>
                  <div className="lb-username">{entry.username}</div>
                </div>
              </div>

              {/* Category */}
              <div className="lb-category" role="cell">
                <span className="badge badge-blue">{entry.category}</span>
              </div>

              {/* Score */}
              <div className="lb-score" role="cell" aria-label={`${entry.score.toLocaleString()} xal`}>
                {entry.score.toLocaleString()}
              </div>

              {/* Change */}
              <div
                className={`lb-change ${entry.change}`}
                role="cell"
                aria-label={
                  entry.change === 'up'   ? `${entry.changeValue} yuxarı` :
                  entry.change === 'down' ? `${entry.changeValue} aşağı` : 'Dəyişim yoxdur'
                }
              >
                <ChangeIcon change={entry.change} value={entry.changeValue} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="leaderboard-footer">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            🔄 Liderlik lövhəsi hər gün gecə saat 00:00-da yenilənir
          </p>
          <button
            id="leaderboard-full-btn"
            className="btn btn-primary btn-lg"
            onClick={() => {
              // TODO: Navigate to /leaderboard
            }}
          >
            Tam Liderlik Lövhəsinə Bax
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
