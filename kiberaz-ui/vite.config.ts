import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
})
