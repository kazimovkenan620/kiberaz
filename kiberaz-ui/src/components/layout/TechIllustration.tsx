import './layout.css';

// ─── Texniki illüstrasiya ─────────────────────────────────────
// Tünd kart üzərində şəbəkə düyünləri + qalxan motivi. Dekorativdir (aria-hidden),
// hər iki mövzuda eyni görünür; yalnız CSS tokenlərindən rəng alır.
interface Props {
  variant?: 'shield' | 'network';
  caption?: string;
  className?: string;
}

const NODES: Array<[number, number, number]> = [
  [40, 60, 3], [120, 30, 2.5], [210, 70, 3], [300, 40, 2], [360, 110, 3],
  [60, 170, 2.5], [150, 210, 3], [250, 190, 2], [330, 230, 3], [90, 250, 2],
  [380, 20, 2], [20, 120, 2], [200, 130, 2],
];
const LINKS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 6],
  [2, 12], [12, 6], [12, 7], [4, 8], [3, 10], [11, 0], [11, 5], [1, 12],
];

export default function TechIllustration({ variant = 'shield', caption, className }: Props) {
  return (
    <div className={`illu${className ? ` ${className}` : ''}`} aria-hidden="true">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="illu__svg">
        <defs>
          <pattern id="illu-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.22" />
          </pattern>
        </defs>
        <rect width="400" height="260" fill="url(#illu-grid)" className="illu__grid" />
        <g className="illu__links" strokeWidth="1">
          {LINKS.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
          ))}
        </g>
        <g className="illu__nodes">
          {NODES.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
        </g>
        {variant === 'shield' && (
          <g className="illu__shield" transform="translate(200 130)">
            <path d="M0 -62 L48 -44 V-4 C48 28 28 52 0 64 C-28 52 -48 28 -48 -4 V-44 Z" strokeWidth="2.5" fill="none" />
            <path d="M0 -46 L34 -33 V-6 C34 17 20 35 0 45 C-20 35 -34 17 -34 -6 V-33 Z" strokeWidth="1.2" fill="none" opacity="0.5" />
            <rect x="-13" y="-8" width="26" height="22" rx="4" strokeWidth="2" fill="none" />
            <path d="M-8 -8 V-15 a8 8 0 0 1 16 0 V-8" strokeWidth="2" fill="none" />
            <circle cx="0" cy="3" r="2.5" />
          </g>
        )}
        {variant === 'network' && (
          <g className="illu__shield" transform="translate(200 130)">
            <circle r="46" strokeWidth="2" fill="none" />
            <circle r="30" strokeWidth="1.2" fill="none" opacity="0.5" />
            <circle r="5" />
            <path d="M-46 0 H46 M0 -46 V46 M-32 -32 L32 32 M-32 32 L32 -32" strokeWidth="1" opacity="0.5" />
          </g>
        )}
      </svg>
      {caption && <div className="illu__caption">{caption}</div>}
      <div className="illu__brand">KIBERAZ<span>.AZ</span></div>
    </div>
  );
}
