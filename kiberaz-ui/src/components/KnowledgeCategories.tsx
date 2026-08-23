import { useState, useEffect } from 'react';
import { ArrowRight, Terminal, Shield, Layers } from 'lucide-react';
import { fetchQuizCategories } from '../services/quizService';
import type { KnowledgeCategory } from '../data/mockData';
import './KnowledgeCategories.css';

interface KnowledgeCategoriesProps {
  onStartQuiz: (categoryId: number) => void;
}

export default function KnowledgeCategories({ onStartQuiz }: KnowledgeCategoriesProps) {
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    fetchQuizCategories().then(cats => {
      setCategories(cats);
      if (cats.length > 0) setActiveId(cats[0].id);
    });
  }, []);

  const active = categories.find(c => c.id === activeId);

  if (!active) return null;

  return (
    <section id="knowledge" className="kd-section" aria-labelledby="kd-heading">
      {/* ── Section Header ── */}
      <div className="kd-header-wrap">
        <div className="kd-tag">
          <Shield size={13} />
          Biliklər Bazası
        </div>
        <h2 className="kd-heading" id="kd-heading">
          Kibertəhlükəsizlik üzrə{' '}
          <span className="kd-gradient">nəzəri biliklərin artırılması</span>
        </h2>
        <p className="kd-subheading">
          Hər kateqoriya üzrə yüzlərlə sualı həll edərək biliklərinizi möhkəmləndirin.
        </p>
      </div>

      {/* ── Dashboard Shell ── */}
      <div className="kd-dashboard">

        {/* ── LEFT: Category List (Master) ── */}
        <nav className="kd-sidebar" aria-label="Bilik kateqoriyaları">
          <div className="kd-sidebar-label">
            <Layers size={11} /> KATEQORİYALAR
          </div>
          {categories.map(cat => (
            <button
              key={cat.id}
              id={`kd-tab-${cat.id}`}
              role="tab"
              aria-selected={cat.id === activeId}
              aria-controls="kd-detail-panel"
              className={`kd-tab ${cat.id === activeId ? 'kd-tab--active' : ''}`}
              style={{ '--cat-clr': cat.color } as React.CSSProperties}
              onClick={() => setActiveId(cat.id)}
            >
              <span className="kd-tab-icon">{cat.icon}</span>
              <span className="kd-tab-info">
                <span className="kd-tab-name">{cat.title}</span>
                <span className="kd-tab-count">{cat.questionCount} sual</span>
              </span>
              {cat.id === activeId && (
                <span className="kd-tab-indicator" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>

        {/* ── RIGHT: Detail Panel ── */}
        <div
          id="kd-detail-panel"
          role="tabpanel"
          aria-labelledby={`kd-tab-${activeId}`}
          className="kd-detail"
          key={activeId}  /* force re-animation on change */
          style={{ '--cat-clr': active.color } as React.CSSProperties}
        >
          {/* Glow Background */}
          <div className="kd-detail-glow" aria-hidden="true" />

          {/* Top Row */}
          <div className="kd-detail-top">
            <div className="kd-detail-icon-wrap">
              <span className="kd-detail-icon">{active.icon}</span>
            </div>
            <div className="kd-detail-meta">
              <div className="kd-detail-kicker">
                <span className="kd-pulse" />
                {active.difficulty.toUpperCase()}
              </div>
              <h3 className="kd-detail-title">{active.title}</h3>
              <p className="kd-detail-desc">{active.description}</p>
            </div>
            <div className="kd-detail-stat">
              <span className="kd-stat-num">{active.questionCount}</span>
              <span className="kd-stat-label">SUAL</span>
            </div>
          </div>

          {/* Terminal Topic List */}
          <div className="kd-terminal">
            <div className="kd-terminal-bar">
              <span className="kd-term-dot kd-dot-red" />
              <span className="kd-term-dot kd-dot-yellow" />
              <span className="kd-term-dot kd-dot-green" />
              <span className="kd-term-title">
                <Terminal size={11} /> {active.title.toLowerCase().replace(' ', '_')}.topics
              </span>
            </div>
            <div className="kd-terminal-body">
              {active.topics.map((topic, i) => (
                <div
                  key={topic}
                  id={`kd-topic-${activeId}-${i}`}
                  className="kd-topic-row"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <span className="kd-topic-prompt" aria-hidden="true">{'>'}</span>
                  <span className="kd-topic-name">{topic}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="kd-detail-actions">
            <button
              id={`kd-start-${activeId}`}
              className="kd-btn-primary"
              onClick={() => onStartQuiz(active.id)}
            >
              Başla <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
