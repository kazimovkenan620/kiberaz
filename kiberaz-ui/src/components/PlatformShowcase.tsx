import { useState, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarCheck2,
  Check,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import { Button, IconButton, Modal } from './ui';
import './PlatformShowcase.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate?: (href: string) => void;
}

const slides = [
  {
    id: 'platform',
    eyebrow: 'Kiberaz.az haqqında',
    title: 'Kiberaz.az nə üçün yaradılıb?',
    description: 'Kiberaz.az kibertəhlükəsizliyi Azərbaycan dilində öyrənmək üçün yaradılmış təhsil platformasıdır. Burada təlimlərə baxa, mövzuları öyrənə və biliklərinizi yoxlaya bilərsiniz.',
    features: ['Azərbaycan dilində öyrənmə materialları', 'Təlim, quiz və imtahan imkanları', 'Yeni başlayanlar və mütəxəssislər üçün məzmun'],
    image: '/platform-showcase/overview.jpg',
    imageTitle: 'Kiberaz.az',
    imageText: 'Azərbaycan dilində kibertəhlükəsizlik platforması',
    icon: ShieldCheck,
    href: '#knowledge',
    action: 'Bilik bazasını aç',
  },
  {
    id: 'courses',
    eyebrow: 'Təlimlər modulu',
    title: 'Təlimlər bölməsi nə üçündür?',
    description: 'Bu bölmədə kibertəhlükəsizlik təlimləri təqdim olunur. Təlimin mövzularına, müddətinə, səviyyəsinə və təlimçi haqqında məlumata baxa bilərsiniz.',
    features: ['Təsdiqlənmiş təlim elanları', 'Təlimçi və proqram haqqında məlumat', 'Sillabus, müddət və səviyyə göstəriciləri'],
    image: '/platform-showcase/courses.jpg',
    imageTitle: 'Təlimlər',
    imageText: 'Peşəkar müəllimlərdən praktik bilik',
    icon: BookOpen,
    href: '#home',
    action: 'Təlimlərə bax',
  },
  {
    id: 'quiz',
    eyebrow: 'Quiz və bilik bazası',
    title: 'Quiz və bilik bazası necə işləyir?',
    description: 'Mövzunu və kateqoriyanı seçərək nəzəri məlumatları oxuya, sonra sualları cavablandıraraq biliyinizi yoxlaya bilərsiniz.',
    features: ['Kateqoriyalar üzrə nəzəri məlumatlar', 'Mövzuya uyğun test sualları', 'Cavabların izahı və nəticələrin saxlanması'],
    image: '/platform-showcase/quiz.jpg',
    imageTitle: 'Quiz və bilik bazası',
    imageText: 'Öyrən · Cavablandır · İnkişaf et',
    icon: BrainCircuit,
    href: '#knowledge',
    action: 'Quizə başla',
  },
  {
    id: 'exam',
    eyebrow: 'İmtahan sessiyaları',
    title: 'İmtahan sessiyası nədir?',
    description: 'VIP istifadəçi sualları və vaxtı seçərək imtahan yaradır (gündə ən çox 7 sessiya). İştirakçı verilən kodla sessiyaya qoşulur və imtahan bitdikdə nəticəsini görür.',
    features: ['Kodla imtahana qoşulma', 'Vaxtlı və nəzarətli sual prosesi', 'Nəticənin avtomatik hesablanması', 'Sessiya yaratmaq — yalnız VIP hesablar'],
    image: '/platform-showcase/exam.jpg',
    imageTitle: 'İmtahan sessiyaları',
    imageText: 'Qoşul · Həll et · Nəticəni gör',
    icon: CalendarCheck2,
    href: '#exam-session',
    action: 'İmtahana keç',
  },
] as const;

export default function PlatformShowcase({ open, onClose, onNavigate }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];
  const ActiveIcon = activeSlide.icon;

  const move = (step: number) => {
    setActiveIndex(current => (current + step + slides.length) % slides.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  };

  const visitModule = () => {
    onClose();
    onNavigate?.(activeSlide.href);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Platformanı kəşf et"
      kicker={`KIBERAZ.AZ · ${String(activeIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`}
      size="lg"
      closeOnBackdrop
    >
      <div className="platform-showcase" onKeyDown={handleKeyDown}>
        <article key={activeSlide.id} className="platform-showcase__card" aria-live="polite">
          <div className="platform-showcase__visual">
            <img src={activeSlide.image} alt="" />
            <div className="platform-showcase__visual-shade" />
            <span className="platform-showcase__module-icon"><ActiveIcon size={24} /></span>
            <div className="platform-showcase__visual-copy">
              <strong>{activeSlide.imageTitle}</strong>
              <span>{activeSlide.imageText}</span>
            </div>
          </div>

          <div className="platform-showcase__content">
            <span className="platform-showcase__eyebrow"><Layers3 size={14} /> {activeSlide.eyebrow}</span>
            <h3>{activeSlide.title}</h3>
            <p>{activeSlide.description}</p>
            <ul>
              {activeSlide.features.map(feature => (
                <li key={feature}><Check size={14} /> <span>{feature}</span></li>
              ))}
            </ul>
            <Button variant="primary" onClick={visitModule}>
              {activeSlide.action} <ArrowRight size={15} />
            </Button>
          </div>
        </article>

        <div className="platform-showcase__nav" aria-label="Platforma modulları">
          <IconButton label="Əvvəlki modul" variant="outline" onClick={() => move(-1)}>
            <ArrowLeft size={17} />
          </IconButton>
          <div className="platform-showcase__steps">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={index === activeIndex ? 'is-active' : ''}
                onClick={() => setActiveIndex(index)}
                aria-label={`${index + 1}. ${slide.eyebrow}`}
                aria-current={index === activeIndex ? 'step' : undefined}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <small>{slide.eyebrow}</small>
              </button>
            ))}
          </div>
          <IconButton label="Növbəti modul" variant="outline" onClick={() => move(1)}>
            <ArrowRight size={17} />
          </IconButton>
        </div>
      </div>
    </Modal>
  );
}
