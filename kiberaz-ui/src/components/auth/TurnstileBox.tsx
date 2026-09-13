import { Turnstile } from '@marsidev/react-turnstile';
import { useTheme } from '../../hooks/useTheme';

// ─── Cloudflare Turnstile ─────────────────────────────────────
// Widget aktiv mövzuya uyğun render olunur; davranışı dəyişmir — token yenə
// yalnız uğurlu yoxlamadan sonra verilir, vaxtı bitəndə/xətada sıfırlanır.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

interface Props {
  onToken: (token: string) => void;
  compact?: boolean;
}

export default function TurnstileBox({ onToken, compact }: Props) {
  const { theme } = useTheme();
  return (
    <div className="turnstile-box">
      <Turnstile
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={onToken}
        onExpire={() => onToken('')}
        onError={() => onToken('')}
        options={{ theme, language: 'az', size: compact ? 'compact' : 'normal' }}
      />
    </div>
  );
}
