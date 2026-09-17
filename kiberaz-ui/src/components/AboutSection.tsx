import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Globe, GraduationCap, Layers, ListChecks, Users } from 'lucide-react';
import { fetchQuizCategories } from '../services/quizService';
import { getApprovedCourses } from '../services/courseService';
import { Button, StatCard } from './ui';
import PlatformShowcase from './PlatformShowcase';
import './AboutSection.css';

// ─── Ana səhifə: missiya, real göstəricilər və platforma haqqında ──
// DÖRD göstəricinin hamısı canlı API-dən hesablanır, heç biri sabit rəqəm deyil:
//   sual və sahə sayı  → /api/quiz/categories
//   mövzu sayı         → həmin kateqoriyaların `topics` massivlərinin cəmi
//   aktiv təlim        → /api/course (yalnız admin təsdiqlədikləri qayıdır)
// Sorğu alınmasa dəyər "—" qalır — sıfır göstərmək "məlumat yoxdur" ilə
// "həqiqətən sıfırdır" arasındakı fərqi itirərdi.

interface Props {
  onNavigate?: (href: string) => void;
}

export default function AboutSection({ onNavigate }: Props) {
  const [totals, setTotals] = useState<{ questions: number; areas: number; topics: number } | null>(null);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [showPlatform, setShowPlatform] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchQuizCategories().then(cats => {
      if (cancelled || cats.length === 0) return;
      setTotals({
        questions: cats.reduce((sum, c) => sum + (Number.isFinite(c.questionCount) ? c.questionCount : 0), 0),
        areas: cats.length,
        topics: cats.reduce((sum, c) => sum + (Array.isArray(c.topics) ? c.topics.length : 0), 0),
      });
    });

    // Təsdiqlənmiş təlimlər ictimai endpoint-dir, giriş tələb etmir.
    getApprovedCourses()
      .then(res => { if (!cancelled && res.success && res.data) setCourseCount(res.data.length); })
      .catch(() => { /* şəbəkə xətası — kart "—" qalır */ });

    return () => { cancelled = true; };
  }, []);

  const num = (value: number | null | undefined) =>
    typeof value === 'number' ? value.toLocaleString('az-AZ') : '—';

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
              {/* Əsas CTA quiz bölməsinə (Biliklər) aparır — istifadəçi oradan
                  kateqoriya seçib dərhal sual həll etməyə başlayır. */}
              <Button variant="primary" size="lg" onClick={() => onNavigate?.('#knowledge')}>
                Təlimlərə başla <ArrowRight size={16} />
              </Button>
              <Button variant="outline" size="lg" onClick={() => setShowPlatform(true)}>
                <Layers size={16} /> Platforma haqqında
              </Button>
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
            value={num(totals?.questions)} label="Nəzəri sual" />
          <StatCard icon={<Layers size={18} />} tone="info"
            value={num(totals?.areas)} label="Bilik sahəsi" />
          <StatCard icon={<ListChecks size={18} />} tone="success"
            value={num(totals?.topics)} label="Mövzu" />
          <StatCard icon={<GraduationCap size={18} />} tone="warning"
            value={num(courseCount)} label="Aktiv təlim" />
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
      <PlatformShowcase
        open={showPlatform}
        onClose={() => setShowPlatform(false)}
        onNavigate={onNavigate}
      />
    </section>
  );
}
