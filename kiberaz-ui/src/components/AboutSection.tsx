import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Briefcase, ClipboardList, Clock, Globe, Layers, Megaphone, Trophy, Unlock, Users } from 'lucide-react';
import { fetchQuizCategories } from '../services/quizService';
import { Button, StatCard } from './ui';
import TechIllustration from './layout/TechIllustration';
import './AboutSection.css';

// ─── Ana səhifə: missiya, real göstəricilər, platforma modulları ──
// Sual və sahə sayı kateqoriya API-sindən hesablanır — sabit "595+" yoxdur.
// "Pulsuz" və "24/7" məhsul faktıdır, rəqəm deyil.

const modules = [
  {
    icon: <Megaphone size={18} />,
    href: '#home',
    title: 'Peşəkar təlimlərin reklamı',
    desc: 'Mütəxəssislər təlimlərini sillabus, müddət və əlaqə məlumatı ilə təqdim edir; sillabus PDF kimi yüklənir.',
  },
  {
    icon: <BookOpen size={18} />,
    href: '#knowledge',
    title: 'Pulsuz nəzəri biliklər',
    desc: 'Network Security, Web Security, Active Directory, SOC, Code Review üzrə izahlı suallar — qeydiyyatsız oxu.',
  },
  {
    icon: <Briefcase size={18} />,
    href: '#knowledge',
    title: 'Müsahibəyə hazırlıq',
    desc: 'Junior, Middle və Senior səviyyələr üzrə real şirkət müsahibə sualları və izahlı cavablar.',
  },
  {
    icon: <ClipboardList size={18} />,
    href: '#exam-session',
    title: 'İmtahan sessiyaları',
    desc: 'Müəllim sessiya yaradır, tələbə kodla qoşulur, nəticə serverdə avtomatik hesablanır.',
  },
  {
    icon: <Trophy size={18} />,
    href: '#leaderboard',
    title: 'Liderlik lövhəsi',
    desc: 'Həftəlik, aylıq və ümumi reytinqlər, kateqoriya üzrə liderlər — yalnız ləqəblə.',
  },
];

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
          <TechIllustration variant="shield" caption="Daha təhlükəsiz Azərbaycan üçün" />
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

        {/* ── Modullar ── */}
        <div id="platform" className="home__modules">
          <div className="section-heading">
            <div>
              <h2>Platforma modulları</h2>
              <p>Kibertəhlükəsizlik sahəsində bilik və bacarıqları inkişaf etdirmək üçün hazırlanmış əsas istiqamətlər.</p>
            </div>
            <a href="#home" className="card__link" onClick={go('#home')}>Hamısını gör <ArrowRight size={13} /></a>
          </div>
          <div className="home__module-grid">
            {modules.map(m => (
              <a key={m.title} href={m.href} className="module-card" onClick={go(m.href)}>
                <span className="module-card__icon" aria-hidden="true">{m.icon}</span>
                <span className="module-card__body">
                  <span className="module-card__title">{m.title}</span>
                  <span className="module-card__desc">{m.desc}</span>
                </span>
                <ArrowRight size={14} className="module-card__arrow" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {/* ── Platforma haqqında ── */}
        <div className="home__about">
          <div className="home__about-col">
            <h3><Users size={16} /> Kimlər üçündür</h3>
            <p>
              Biz inanırıq ki, rəqəmsal təhlükəsizlik yalnız böyük şirkətlərin deyil, bütün cəmiyyətin əsas
              prioritetlərindən biri olmalıdır. <strong>Kiberaz.az</strong> platforması peşəkar müəllimlərə biliklərini
              paylaşmaq və təlimlərini tanıtmaq imkanı yaradır, tələbələrə isə pulsuz nəzəri materiallar,
              müsahibəyə hazırlıq resursları və imtahan sistemi təqdim edir.
            </p>
          </div>
          <div className="home__about-col">
            <h3><Globe size={16} /> Məqsədimiz</h3>
            <p>
              Ölkədə ixtisaslı kiber mütəxəssislərin sayını artırmaq, bu sahəyə marağı gücləndirmək və keyfiyyətli
              tədris resurslarına çıxışı hər kəs üçün daha əlçatan etməkdir. Bütün bu imkanlar qeydiyyat maneəsi
              olmadan, sadə və rahat şəkildə açıqdır — məqsəd Azərbaycanda güclü kiber icmanın formalaşmasına
              töhfə verməkdir.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
