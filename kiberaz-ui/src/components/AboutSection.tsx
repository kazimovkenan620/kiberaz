import { Shield, Megaphone, BookOpen, Briefcase, ClipboardList } from 'lucide-react';
import './AboutSection.css';

const stats = [
  { value: '595+', label: 'Nəzəri Sual',          icon: '📚' },
  { value: '5+',   label: 'Praktik Modul', icon: '🧪' },
  { value: '100%', label: 'Pulsuz Giriş',          icon: '🆓' },
  { value: '24/7', label: 'Daim Əlçatımlı',        icon: '🌐' },
];

const modules = [
  {
    icon: <Megaphone size={22} />,
    color: '#00d4ff',
    tag: 'Təlim Platforması',
    title: 'Peşəkar Təlimlərin Reklamı',
    desc: 'Azərbaycanın aparıcı kibertəhlükəsizlik mütəxəssisləri öz təlimlərini — sillabus, müddət, əlaqə məlumatları ilə birlikdə — bu platformada təqdim edir. Tələbələr sillabusu PDF formatında yükləyir, müəllimlə birbaşa əlaqə qurur.',
  },
  {
    icon: <BookOpen size={22} />,
    color: '#00e5a0',
    tag: 'Bilik Bazası',
    title: 'Pulsuz Nəzəri Biliklərin Artırılması',
    desc: 'Network Security, Web Security, Active Directory, SOC, Code Review və digər sahələr üzrə 595+ sual — cavabları və izahları ilə birlikdə. Qeydiyyat olmadan, pulsuzcasına, istənilən vaxt başla.',
  },
  {
    icon: <Briefcase size={22} />,
    color: '#f5a623',
    tag: 'Karyera Hazırlığı',
    title: 'Müsahibəyə Sistematik Hazırlıq',
    desc: 'Junior, Middle və Senior səviyyələr üzrə real şirkət müsahibə sualları. Hər sualın izahlı cavabı, texniki dərinliyi və tövsiyəsi mövcuddur. Karyera cığırını doğru qurmaq üçün ideal başlanğıc nöqtəsi.',
  },
  {
    icon: <ClipboardList size={22} />,
    color: '#ef4444',
    tag: 'Qiymətləndirmə',
    title: 'Təlim Tələbələrinin İmtahan Edilməsi',
    desc: 'Təlim müəllimləri xüsusi imtahan sessiyaları yarada bilər. Tələbələr sessiya kodu ilə qoşulur, müəllim real vaxt rejimində nəticələri izləyir. Rəqəmsal qiymətləndirmənin ən sadə və effektiv forması.',
  },
  {
    icon: <Shield size={22} />,
    color: '#3b82f6',
    tag: 'İcma & Rəqabət',
    title: 'Liderlik Lövhəsi & Reytinq Sistemi',
    desc: 'Həftəlik və aylıq reytinqlər, kateqoriya üzrə liderlər. İrəliləyişini izlə, platforma icmasında özünü sına. Kiber biliyini rəqabət mühitində yoxla.',
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="ab-section" aria-labelledby="ab-heading">
      {/* Decorative lines */}
      <div className="ab-line ab-line-left"  aria-hidden="true" />
      <div className="ab-line ab-line-right" aria-hidden="true" />

      <div className="ab-container">

        {/* ── Mission Block ── */}
        <div className="ab-mission">
          <div className="ab-tag">
            <span className="ab-tag-dot" />
            Missiyamız
          </div>

          <h1 className="ab-heading" id="ab-heading">
            Azərbaycan kibertəhlükəsizlik<br />
            <span className="ab-accent">mütəxəssislərinin yetişdirilməsinə töhfə veririk</span>
          </h1>

          <p className="ab-mission-text">
            <strong>Kiberaz.az</strong> Azərbaycanda kibertəhlükəsizlik sahəsinin inkişafına dəstək vermək məqsədilə yaradılmış açıq təhsil platformasıdır. Məqsədimiz ölkədə ixtisaslı kiber mütəxəssislərin sayını artırmaq, bu sahəyə marağı gücləndirmək və keyfiyyətli tədris resurslarına çıxışı hər kəs üçün daha əlçatan etməkdir.
          </p>
          <p className="ab-mission-text">
            Biz inanırıq ki, rəqəmsal təhlükəsizlik yalnız böyük şirkətlərin deyil, bütün cəmiyyətin əsas prioritetlərindən biri olmalıdır. <strong>Kiberaz.az</strong> platforması peşəkar müəllimlərə biliklərini paylaşmaq və təlimlərini tanıtmaq imkanı yaradır, tələbələrə isə pulsuz nəzəri materiallar, müsahibəyə hazırlıq resursları və imtahan sistemi təqdim edir.
          </p>
          <p className="ab-mission-text">
            Bütün bu imkanlar qeydiyyat maneəsi olmadan, sadə və rahat şəkildə istifadəçilərə açıqdır. Məqsədimiz kibertəhlükəsizlik biliklərini daha geniş auditoriyaya çatdırmaq və Azərbaycanda güclü kiber icmanın formalaşmasına töhfə verməkdir.
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="ab-stats">
          {stats.map((s, i) => (
            <div key={i} className="ab-stat-card">
              <span className="ab-stat-emoji">{s.icon}</span>
              <span className="ab-stat-val">{s.value}</span>
              <span className="ab-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Modules divider ── */}
        <div className="ab-modules-header">
          <span className="ab-modules-line" aria-hidden="true" />
          <span className="ab-modules-label">Platforma Modulları</span>
          <span className="ab-modules-line" aria-hidden="true" />
        </div>

        {/* ── Modules Grid ── */}
        <div className="ab-pillars">
          {modules.map((m, i) => (
            <div
              key={i}
              className="ab-pillar"
              style={{ '--p-clr': m.color } as React.CSSProperties}
            >
              <div className="ab-pillar-top">
                <div className="ab-pillar-icon">{m.icon}</div>
                <span className="ab-pillar-tag">{m.tag}</span>
              </div>
              <h3 className="ab-pillar-title">{m.title}</h3>
              <p className="ab-pillar-desc">{m.desc}</p>
              <div className="ab-pillar-line" aria-hidden="true" />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
