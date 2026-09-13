import type { ReactNode } from 'react';
import {
  Briefcase, Building2, Code2, Globe, Network, Activity, Swords, Shield, Layers, FileQuestion,
} from 'lucide-react';

// ─── Kateqoriya ikonu ─────────────────────────────────────────
// Backend kateqoriyanın `icon` sahəsini emoji kimi saxlayır. Dizayn sistemində
// naviqasiya ikonları xətti (lucide) olduğu üçün tanınan emoji-lər ikonla göstərilir;
// tanınmayanlar olduğu kimi (emoji) qalır — məlumat itmir.
const EMOJI_TO_ICON: Record<string, (size: number) => ReactNode> = {
  '🔌': s => <Network size={s} />,
  '🕸️': s => <Globe size={s} />,
  '🕸': s => <Globe size={s} />,
  '🏢': s => <Building2 size={s} />,
  '📊': s => <Activity size={s} />,
  '💻': s => <Code2 size={s} />,
  '💼': s => <Briefcase size={s} />,
  '🌐': s => <Globe size={s} />,
  '⚔️': s => <Swords size={s} />,
  '⚔': s => <Swords size={s} />,
  '🛡️': s => <Shield size={s} />,
  '🛡': s => <Shield size={s} />,
  '📚': s => <Layers size={s} />,
};

export function categoryIcon(icon: string | undefined, size = 16): ReactNode {
  if (!icon) return <FileQuestion size={size} />;
  const render = EMOJI_TO_ICON[icon.trim()];
  if (render) return render(size);
  return <span aria-hidden="true" style={{ fontSize: size * 0.9, lineHeight: 1 }}>{icon}</span>;
}
