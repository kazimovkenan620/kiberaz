import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Windows-da Node bəzən "localhost"-u yalnız IPv6-ya (::1) bağlayır, 127.0.0.1 isə refuse edir.
    // Backend konfiqurasiyası (FrontendUrl, Google OAuth origin) məhz 127.0.0.1/localhost-a əsaslandığı üçün
    // burda IPv4-ü açıq şəkildə göstəririk ki, hər zaman eyni ünvana bağlansın.
    host: '127.0.0.1',
    port: 5173,
  },
})
