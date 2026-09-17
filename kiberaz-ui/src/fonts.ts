// Şriftlər özümüzdə saxlanılır (audit F4): ziyarətçi Google-a sorğu göndərmir, CSP-də kənar mənbə qalmır,
// Google əlçatmaz olanda şrift gecikmir. Yalnız latin + latin-ext alt çoxluqları (Azərbaycan hərfləri ə/ğ/ı/ş/ç/ö/ü
// latin-ext-də) yüklənir; Vite woff2 fayllarını dist/assets-ə hash-lə çıxarır.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-ext-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-ext-600.css';
