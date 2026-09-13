import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import IconButton from './IconButton';

// ─── Mövzu dəyişdirici ────────────────────────────────────────
// Tətbiq qabığında bir dəfə göstərilir; səhifə yenilənmədən mövzunu dəyişir.
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <IconButton
      label={dark ? 'Açıq mövzuya keç' : 'Tünd mövzuya keç'}
      onClick={toggleTheme}
      className={className}
      aria-pressed={dark}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}
