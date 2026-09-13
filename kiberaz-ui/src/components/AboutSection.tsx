import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Clock, Globe, Layers, Unlock, Users } from 'lucide-react';
import { fetchQuizCategories } from '../services/quizService';
import { Button, StatCard } from './ui';
import './AboutSection.css';

// ─── Ana səhifə: missiya, real göstəricilər və platforma haqqında ──
// Sual və sahə sayı kateqoriya API-sindən hesablanır — sabit "595+" yoxdur.
// "Pulsuz" və "24/7" məhsul faktıdır, rəqəm deyil.

interface Props {
  onNavigate?: (href: string) => void;
}

export default function AboutSection({ onNavigate }: Props) {
  const [totals, setTotals] = useState<{ questions: number; areas: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuizCategories().then(cats => {
      if (cancelled || cats.length === 0) return;
      setTotals({
        questions: cats.reduce((sum, c) => sum + (Number.isFinite(c.questionCount) ? c.questionCount : 0), 0),
        areas: cats.length,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const go = (href: string) => (e: React.MouseEvent) => {
    if (!onNavigate) return;
    e.preventDefault();
    onNavigate(href);
  };

  return (
    <section id="about" className="home" aria-labelledby="home-heading">
      <div className="container">

        {/* ── Missiya ── */}
        <div className="home__hero">
          <div className="home__hero-text">
            <div className="kicker">Missiyamız</div>
            <h1 className="home__title" id="home-heading">
              Azərbaycanda kibertəhlükəsizlik mütəxəssislərinin inkişafına töhfə veririk
            </h1>
            <p className="home__lead">
              <strong>Kiberaz.az</strong> — hər kəs üçün əlçatan, keyfiyyətli və praktiki yönümlü kibertəhlükəsizlik
              təhsili imkanları yaradan milli platformadır. Öyrən, inkişaf et, daha təhlükəsiz bir Azərbaycan üçün
              birlikdə addımlayaq!
            </p>
            <div className="home__cta">
              <Button variant="primary" size="lg" onClick={() => onNavigate?.('#home')}>
                Təlimlərə başla <ArrowRight size={16} />
              </Button>
              <a href="#platform" className="btn btn--outline btn--lg" onClick={go('#platform')}>
                <Layers size={16} /> Platforma haqqında
              </a>
            </div>
          </div>
          <div className="home__hero-visual">
            <img
              src="/kiberaz-cyber-hero.png"
              alt="Azərbaycan xəritəsi, qalxan və qıfıldan ibarət kibertəhlükəsizlik illüstrasiyası"
            />
          </div>
        </div>

        {/* ── Real göstəricilər ── */}
        <div className="home__stats stat-grid" aria-label="Platforma göstəriciləri">
          <StatCard icon={<BookOpen size={18} />} tone="brand"
            value={totals ? totals.questions.toLocaleString('az-AZ') : '—'} label="Nəzəri sual" />
          <StatCard icon={<Layers size={18} />} tone="info"
            value={totals ? totals.areas : '—'} label="Bilik sahəsi" />
          <StatCard icon={<Unlock size={18} />} tone="success" value="Pulsuz" label="Bütün nəzəri material" />
          <StatCard icon={<Clock size={18} />} tone="warning" value="24/7" label="Əlçatanlıq" />
        </div>

        {/* ── Platforma haqqında ── */}
        <div id="platform" className="home__about">
          <div className="home__about-col">
            <h3><Users size={16} /> Kimlər üçündür</h3>
            <p>
              <strong>Kiberaz.az</strong> kibertəhlükəsizliyə yeni başlayan tələbələr, biliklərini sistemləşdirmək
              istəyən mütəxəssislər və tədris prosesini rəqəmsal idarə edən müəllimlər üçün yaradılıb. Platforma
              nəzəri bilik bazasını, praktiki testləri, müsahibə hazırlığını, təlim elanlarını və imtahan
              sessiyalarını vahid öyrənmə mühitində birləşdirir.
            </p>
          </div>
          <div className="home__about-col">
            <h3><Globe size={16} /> Məqsədimiz</h3>
            <p>
              Məqsədimiz Azərbaycan dilində etibarlı, praktik və davamlı kibertəhlükəsizlik təhsil ekosistemi
              qurmaqdır. Kateqoriyalara və nəzəri məzmuna açıq baxış mümkündür; cavabların yoxlanılması,
              nəticələrin saxlanması, liderlik reytinqi və imtahan imkanları üçün istifadəçi hesabına giriş
              tələb olunur.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
