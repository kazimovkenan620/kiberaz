import { useState } from 'react';
import { ClipboardList, Plus, LogIn, Copy, Check, Users, Clock, FileText, X, Zap, BookOpen, Globe, Shield } from 'lucide-react';
import { examSessions } from '../data/mockData';
import './ExamSession.css';

// ── Sabit məlumatlar ──────────────────────────────────────────
const statusMap: Record<string, { label: string; className: string; icon: string }> = {
  'Aktiv':      { label: 'Aktiv',      className: 'status-active',   icon: '🟢' },
  'Gözlənilir': { label: 'Gözlənilir', className: 'status-waiting',  icon: '🟡' },
  'Tamamlandı': { label: 'Tamamlandı', className: 'status-finished', icon: '⚪' },
};

const categories = [
  { id: 'crypto',  label: 'Kriptoqrafiya',       icon: <BookOpen size={15} />,  color: '#a855f7', max: 30 },
  { id: 'network', label: 'Şəbəkə Təhlükəsizliyi', icon: <Globe size={15} />,    color: '#3b82f6', max: 40 },
  { id: 'web',     label: 'Veb Təhlükəsizliyi',  icon: <Zap size={15} />,       color: '#ef4444', max: 50 },
  { id: 'general', label: 'Ümumi Hazırlıq',      icon: <Shield size={15} />,    color: '#00e5a0', max: 40 },
];

// Tövsiyə edilən hazır paketlər
const presets = [
  {
    id: 'quick',
    label: 'Sürətli Test',
    desc: '15 dəq · 10 sual · Ümumi mövzular',
    icon: '⚡',
    color: '#00e5a0',
    duration: 15,
    counts: { crypto: 0, network: 3, web: 4, general: 3 },
  },
  {
    id: 'standard',
    label: 'Standart İmtahan',
    desc: '45 dəq · 25 sual · Qarışıq kateqoriyalar',
    icon: '📋',
    color: '#3b82f6',
    duration: 45,
    counts: { crypto: 5, network: 7, web: 8, general: 5 },
  },
  {
    id: 'deep',
    label: 'Dərin Analiz',
    desc: '90 dəq · 50 sual · Bütün sahələr',
    icon: '🔬',
    color: '#a855f7',
    duration: 90,
    counts: { crypto: 12, network: 14, web: 16, general: 8 },
  },
];

// ── "Sessiya Yarat" Modal ─────────────────────────────────────
function CreateSessionModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'preset' | 'custom' | 'done'>('preset');
  const [duration, setDuration] = useState(45);
  const [counts, setCounts] = useState<Record<string, number>>({ crypto: 5, network: 7, web: 8, general: 5 });
  const [sessionName, setSessionName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const totalQ = Object.values(counts).reduce((s, v) => s + v, 0);

  const applyPreset = (p: typeof presets[0]) => {
    setDuration(p.duration);
    setCounts({ ...p.counts });
    setStep('custom');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim() || totalQ === 0) return;
    setSubmitted(true);
    // TODO: POST /api/exam-sessions/create
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel es-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-kicker"><span className="kicker-pulse" /> İMTAHAN SİSTEMİ</div>
            <h2 className="modal-title">Sessiya Yarat</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><X size={18} /></button>
        </div>

        {submitted ? (
          /* ── Uğur ekranı ── */
          <div className="modal-success">
            <div className="success-icon">✓</div>
            <h3>Sessiya Yaradıldı!</h3>
            <p>Tələbələrə sessiya kodunu paylaşın. Onlar kod ilə imtahana qoşula bilərlər.</p>
            <div className="es-generated-code">KBR-{Math.random().toString(36).substring(2,6).toUpperCase()}</div>
            <button className="es-btn-primary" onClick={onClose}>Bağla</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleCreate}>

            {step === 'preset' && (
              <>
                {/* Tövsiyə olunan paketlər */}
                <div className="form-section-label">⚡ Tövsiyə Olunan Hazır Paketlər</div>
                <div className="es-presets">
                  {presets.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="es-preset-card"
                      style={{ '--p-clr': p.color } as React.CSSProperties}
                      onClick={() => applyPreset(p)}
                    >
                      <span className="es-preset-icon">{p.icon}</span>
                      <span className="es-preset-label">{p.label}</span>
                      <span className="es-preset-desc">{p.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="es-divider">
                  <span />
                  <span>və ya özün konfiqurasiya et</span>
                  <span />
                </div>
                <button type="button" className="es-btn-outline" onClick={() => setStep('custom')}>
                  Əl ilə Konfiqurasiya
                </button>
              </>
            )}

            {step === 'custom' && (
              <>
                {/* Sessiya adı */}
                <div className="form-section-label">📝 Sessiya Məlumatları</div>
                <div className="form-field">
                  <label htmlFor="es-name">Sessiya Adı *</label>
                  <input
                    id="es-name"
                    type="text"
                    placeholder="Məs: Web Security Final İmtahanı"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    required
                  />
                </div>

                {/* Müddət */}
                <div className="form-section-label">⏱ İmtahan Müddəti</div>
                <div className="es-duration-row">
                  {[15, 30, 45, 60, 90, 120].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`es-dur-btn ${duration === d ? 'active' : ''}`}
                      onClick={() => setDuration(d)}
                    >
                      {d} dəq
                    </button>
                  ))}
                </div>

                {/* Kateqoriyalar */}
                <div className="form-section-label">📚 Kateqoriya üzrə Sual Sayı</div>
                <div className="es-categories">
                  {categories.map(cat => (
                    <div key={cat.id} className="es-cat-row" style={{ '--c-clr': cat.color } as React.CSSProperties}>
                      <span className="es-cat-icon">{cat.icon}</span>
                      <span className="es-cat-label">{cat.label}</span>
                      <div className="es-cat-controls">
                        <button
                          type="button"
                          className="es-cnt-btn"
                          onClick={() => setCounts(p => ({ ...p, [cat.id]: Math.max(0, p[cat.id] - 1) }))}
                        >−</button>
                        <span className="es-cnt-val">{counts[cat.id]}</span>
                        <button
                          type="button"
                          className="es-cnt-btn"
                          onClick={() => setCounts(p => ({ ...p, [cat.id]: Math.min(cat.max, p[cat.id] + 1) }))}
                        >+</button>
                      </div>
                      <span className="es-cat-max">maks {cat.max}</span>
                    </div>
                  ))}
                </div>

                {/* Xülasə */}
                <div className="es-summary">
                  <span>Cəmi: <strong>{totalQ} sual</strong></span>
                  <span>Müddət: <strong>{duration} dəqiqə</strong></span>
                  <span>Hər suala: <strong>{totalQ > 0 ? Math.floor((duration * 60) / totalQ) : 0} san</strong></span>
                </div>

                <div className="modal-footer">
                  <p className="modal-note">* Sessiya yaradıldıqdan sonra unikal kod avtomatik generasiya olunacaq.</p>
                  <div className="modal-footer-actions">
                    <button type="button" className="es-btn-outline" onClick={() => setStep('preset')}>Geri</button>
                    <button
                      type="submit"
                      className="es-btn-primary"
                      disabled={totalQ === 0 || !sessionName.trim()}
                    >
                      <Plus size={15} /> Sessiya Yarat
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ── Ana Komponent ─────────────────────────────────────────────
export default function ExamSession() {
  const [sessionCode, setSessionCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const demoCode = 'KBR-7X4M';

  const handleCopy = () => {
    navigator.clipboard.writeText(demoCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim()) return;
    // TODO: POST /api/exam-sessions/join
  };

  return (
    <>
      <section id="exam-session" className="exam-section" aria-labelledby="exam-section-title">
        <div className="container">
          {/* Header */}
          <div className="section-header">
            <div className="section-tag">
              <ClipboardList size={14} />
              İmtahan Sistemi
            </div>
            <h2 className="section-title" id="exam-section-title">
              İmtahan <span className="gradient-text">Sessiyaları</span>
            </h2>
            <p className="section-description">
              Müəllimlər öz tələbələri üçün kateqoriya və sual sayı seçərək xüsusi imtahan
              sessiyaları yarada bilər. Tələbələr sessiya kodu ilə qoşulur.
            </p>
          </div>

          <div className="exam-layout">
            {/* ── Sol: Əməliyyatlar ── */}
            <div className="exam-left">
              {/* Sessiya Yarat */}
              <div className="exam-action-card" style={{ '--action-color': 'var(--brand-primary)' } as React.CSSProperties}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                    <Plus size={20} />
                  </div>
                  <div className="exam-action-title">Sessiya Yarat</div>
                </div>
                <p className="exam-action-desc">
                  Kateqoriya, sual sayı və vaxtı seçərək tələbələriniz üçün fərdi imtahan sessiyası hazırlayın.
                  Hazır paket seçimləri də mövcuddur.
                </p>
                <button id="exam-create-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  <Plus size={16} /> Sessiya Yarat
                </button>
              </div>

              {/* Sessiyaya Qoşul */}
              <div className="exam-action-card" style={{ '--action-color': 'var(--color-success)' } as React.CSSProperties}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                    <LogIn size={20} />
                  </div>
                  <div className="exam-action-title">Sessiyaya Qoşul</div>
                </div>
                <p className="exam-action-desc">Müəllimdən aldığınız sessiya kodunu daxil edərək imtahana qoşulun. Kod formatı: KBR-XXXX</p>
                <form id="exam-join-form" className="exam-join-form" onSubmit={handleJoin}>
                  <input
                    id="exam-session-code-input"
                    className="exam-join-input"
                    type="text"
                    placeholder="KBR-XXXX"
                    value={sessionCode}
                    onChange={e => setSessionCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    aria-label="Sessiya kodu"
                  />
                  <button id="exam-join-btn" type="submit" className="btn btn-success">
                    <LogIn size={16} /> Qoşul
                  </button>
                </form>
              </div>
            </div>

            {/* ── Sağ: Dashboard ── */}
            <div className="exam-right">
              <div className="exam-dashboard-card">
                <div className="exam-dashboard-header">
                  <div className="exam-dashboard-title">📊 Müəllim Paneli — Nümunə</div>
                  <div className="exam-status-dot">Canlı</div>
                </div>
                <div className="exam-dashboard-body">
                  <div className="exam-session-code">
                    <div>
                      <div className="exam-session-code-label">Sessiya Kodu</div>
                      <div className="exam-session-code-value">{demoCode}</div>
                    </div>
                    <button id="exam-copy-code-btn" className="exam-session-code-copy" onClick={handleCopy} aria-label="Kopyala">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="exam-dashboard-stats">
                    <div className="exam-dashboard-stat">
                      <div className="exam-dashboard-stat-num">24</div>
                      <div className="exam-dashboard-stat-label"><Users size={10} style={{ display: 'inline', marginRight: 2 }} />Tələbə</div>
                    </div>
                    <div className="exam-dashboard-stat">
                      <div className="exam-dashboard-stat-num">18</div>
                      <div className="exam-dashboard-stat-label"><FileText size={10} style={{ display: 'inline', marginRight: 2 }} />Sual</div>
                    </div>
                    <div className="exam-dashboard-stat">
                      <div className="exam-dashboard-stat-num">45</div>
                      <div className="exam-dashboard-stat-label"><Clock size={10} style={{ display: 'inline', marginRight: 2 }} />Dəq.</div>
                    </div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>İrəliləyiş</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>18 / 24 tamamladı</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--neutral-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 'var(--radius-full)' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span aria-hidden="true">📋</span> Aktiv Sessiyalar
                </div>
                <div className="exam-sessions-list">
                  {examSessions.map(session => {
                    const status = statusMap[session.status];
                    return (
                      <div key={session.id} id={`exam-session-item-${session.id}`} className="exam-session-item" role="listitem">
                        <span className={`exam-session-status ${status.className}`}>{status.icon} {session.status}</span>
                        <div className="exam-session-info">
                          <div className="exam-session-title">{session.title}</div>
                          <div className="exam-session-meta">{session.instructor} · {session.studentCount} tələbə · {session.duration}</div>
                        </div>
                        <span className="badge" style={{ background: 'var(--neutral-100)', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                          {session.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
