import { useState, useEffect } from 'react';
import { ArrowRight, BookOpen, HelpCircle, Layers, Play } from 'lucide-react';
import { fetchQuizCategories } from '../services/quizService';
import type { KnowledgeCategory } from '../data/mockData';
import { categoryIcon } from '../utils/categoryIcon';
import { Button, EmptyState, SkeletonList } from './ui';
import CategoryArtwork from './layout/CategoryArtwork';
import './KnowledgeCategories.css';

// ─── Biliklər bazası: kateqoriya siyahısı (sol) + seçilmiş kateqoriyanın detalı (sağ) ──
// Bütün məlumat real API-dəndir: ad, ikon, təsvir, mövzular, sual sayı, çətinlik.
// İctimai səhifədə nəzəri məzmuna baxış açıqdır; cavab yoxlaması və nəticələr üçün giriş tələb olunur.

interface KnowledgeCategoriesProps {
  onStartQuiz: (categoryId: number) => void;
}

export default function KnowledgeCategories({ onStartQuiz }: KnowledgeCategoriesProps) {
  const [categories, setCategories] = useState<KnowledgeCategory[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuizCategories().then(cats => {
      if (cancelled) return;
      setCategories(cats);
      if (cats.length > 0) setActiveId(current => current ?? cats[0].id);
    });
    return () => { cancelled = true; };
  }, []);

  const active = categories?.find(c => c.id === activeId) ?? null;

  return (
    <section id="knowledge" className="kb page-section" aria-labelledby="kb-heading">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="kicker">Biliklər bazası</div>
            <h2 id="kb-heading">Kibertəhlükəsizlik üzrə nəzəri biliklərin artırılması</h2>
            <p>Kateqoriya və mövzulara açıq baxın. Cavabları yoxlamaq və nəticələrinizi saxlamaq üçün hesabınıza daxil olun.</p>
          </div>
        </div>

        {categories === null && (
          <div className="kb__layout" aria-busy="true">
            <div className="card card--pad-sm"><SkeletonList rows={5} /></div>
            <div className="card card--pad"><SkeletonList rows={4} /></div>
          </div>
        )}

        {categories !== null && categories.length === 0 && (
          <div className="card">
            <EmptyState icon={<BookOpen size={20} />} title="Kateqoriya tapılmadı" text="Sual bazası hazırlanır — bir az sonra yenidən yoxlayın." />
          </div>
        )}

        {active && categories && (
          <div className="kb__layout">
            {/* ── Kateqoriya siyahısı ── */}
            <nav className="kb__list sidebar" aria-label="Bilik kateqoriyaları">
              <div className="sidebar__title"><Layers size={11} /> Kateqoriyalar</div>
              <div className="sidebar__nav" role="tablist" aria-orientation="vertical">
                {categories.map(cat => {
                  const selected = cat.id === activeId;
                  return (
                    <button
                      key={cat.id}
                      id={`kd-tab-${cat.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="kd-detail-panel"
                      tabIndex={selected ? 0 : -1}
                      className={`sidebar__item${selected ? ' is-active' : ''}`}
                      onClick={() => setActiveId(cat.id)}
                      onKeyDown={e => {
                        const idx = categories.findIndex(c => c.id === activeId);
                        let next = -1;
                        if (e.key === 'ArrowDown') next = (idx + 1) % categories.length;
                        if (e.key === 'ArrowUp') next = (idx - 1 + categories.length) % categories.length;
                        if (next < 0) return;
                        e.preventDefault();
                        setActiveId(categories[next].id);
                        document.getElementById(`kd-tab-${categories[next].id}`)?.focus();
                      }}
                    >
                      <span className="sidebar__icon">{categoryIcon(cat.icon, 17)}</span>
                      <span className="sidebar__text">
                        <span className="sidebar__label">{cat.title}</span>
                        <span className="sidebar__meta">{cat.questionCount} sual · {cat.topics.length} mövzu</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* ── Detal ── */}
            <div id="kd-detail-panel" role="tabpanel" aria-labelledby={`kd-tab-${active.id}`} className="kb__detail card" key={active.id}>
              <div className="kb__overview">
                <div className="kb__intro">
                  <div className="kb__detail-head">
                    <span className="kb__detail-icon" aria-hidden="true">{categoryIcon(active.icon, 22)}</span>
                    <div className="kb__detail-meta">
                      <span className="kicker">{active.difficulty}</span>
                      <h3 className="kb__detail-title">{active.title}</h3>
                      <p className="kb__detail-desc">{active.description}</p>
                    </div>
                  </div>

                  <div className="kb__stats">
                    <span className="tag"><HelpCircle size={13} /> {active.questionCount} sual</span>
                    <span className="tag"><BookOpen size={13} /> {active.topics.length} mövzu</span>
                    <span className="tag"><Layers size={13} /> {active.difficulty}</span>
                  </div>
                </div>
                <CategoryArtwork title={active.title} />
              </div>

              {active.topics.length > 0 && (
                <div className="kb__topics">
                  <div className="kb__topics-title">Mövzular</div>
                  <ol className="list kb__topic-list">
                    {active.topics.map((topic, i) => (
                      <li key={topic} id={`kd-topic-${active.id}-${i}`} className="list__row">
                        <span className="list__num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="list__main"><span className="list__title">{topic}</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="kb__actions">
                <Button id={`kd-start-${active.id}`} variant="primary" size="lg" onClick={() => onStartQuiz(active.id)} disabled={active.questionCount === 0}>
                  <Play size={16} /> Başla <ArrowRight size={15} />
                </Button>
                {active.questionCount === 0 && <span className="text-3 text-sm">Bu kateqoriyada hələ sual yoxdur.</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
