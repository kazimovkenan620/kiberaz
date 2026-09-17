import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// index.html-dəki CSP meta-sında API mənşəyi (%API_ORIGIN%) VITE_API_URL-dən hesablanır ki,
// eyni fayl həm lokalda (http://localhost:5251), həm də production-da (https://api...) düz olsun.
// %CSP_UPGRADE% yalnız production build-də `upgrade-insecure-requests` olur — dev-də http API-ni
// https-ə çevirsəydi bütün sorğular sınardı.
// %CSP_DEV%: dev serverdə Vite/React Refresh inline preamble skripti yeridir; ona yalnız dev-də
// sabit nonce ilə icazə verilir (html.cspNonce). Production build-də inline skript yoxdur → boş.
const DEV_NONCE = 'kiberaz-dev'

// %CSP_STYLE_DEV%: Vite dev serverdə CSS-i <style> elementi kimi yeridir (HMR) — yalnız dev-də 'unsafe-inline';
// production build-də CSS ayrıca fayldır, style-src-elem 'self' kifayətdir (audit F3).
function cspPlaceholders(mode: string, isBuild: boolean): Plugin {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  let origin = "'self'"
  const apiUrl = env.VITE_API_URL || 'http://localhost:5251/api'
  try { origin = new URL(apiUrl).origin } catch { /* 'self' qalır */ }

  // Production build lokal API ünvanı ilə çıxmasın (audit F9): CSP-də http://localhost qalır və
  // upgrade-insecure-requests bütün API sorğularını sındırır. Bilərəkdən lazımdırsa VITE_ALLOW_LOCAL_API=1.
  if (isBuild && mode === 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiUrl) && env.VITE_ALLOW_LOCAL_API !== '1') {
    throw new Error(
      `VITE_API_URL production build üçün lokal ünvana (${apiUrl}) yönəlib. .env.production faylında real API ünvanını təyin edin ` +
      '(nümunə: env.production.example → .env.production kimi kopyalayın) və ya bilərəkdən lokal build üçün VITE_ALLOW_LOCAL_API=1 verin.')
  }
  return {
    name: 'kiberaz-csp-placeholders',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // replaceAll: placeholder həm meta-da, həm izah şərhində keçir.
        return html
          .replaceAll('%API_ORIGIN%', origin)
          .replaceAll('%CSP_DEV%', isBuild ? '' : `'nonce-${DEV_NONCE}'`)
          .replaceAll('%CSP_STYLE_DEV%', isBuild ? '' : "'unsafe-inline'")
          .replaceAll('%CSP_UPGRADE%', isBuild ? 'upgrade-insecure-requests' : '')
      },
    },
  }
}

export default defineConfig(({ mode, command }) => ({
  plugins: [react(), cspPlaceholders(mode, command === 'build')],
  html: { cspNonce: command === 'build' ? undefined : DEV_NONCE },
  server: {
    // BÜTÜN dev axını eyni host adında qalmalıdır: 'localhost'.
    //
    // Niyə 127.0.0.1 deyil — iki səbəb, hər ikisi səssiz sınır:
    //   1) Cloudflare Turnstile IP ünvanını host kimi QƏBUL ETMİR. 127.0.0.1-də widget
    //      "Unable to connect to website" verir; icazə siyahısına yalnız 'localhost' yazıla bilir.
    //   2) Brauzer üçün 127.0.0.1 və localhost AYRI hostlardır. Səhifə 127.0.0.1-də,
    //      API isə localhost-da olanda sorğu cross-site sayılır və SameSite=Strict olan
    //      refresh_token cookie-si GÖNDƏRİLMİR — sessiya 15 dəqiqədən sonra sükutla ölür.
    //
    // API ünvanı (.env → VITE_API_URL) və backend FrontendUrl də 'localhost' olmalıdır.
    host: 'localhost',
    port: 5173,
  },
}))
