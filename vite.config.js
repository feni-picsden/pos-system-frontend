import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', 
    port: 5173, 
    strictPort: true, 
    allowedHosts: true, 
    headers: {
      'ngrok-skip-browser-warning': 'true'
    },
    proxy: {
      '/api': {
        target: 'https://pos-system-backend-five.vercel.app', // ponytail: temp — loca.lt tunnel down; restore tunnel URL after testing
        changeOrigin: true,
        secure: false,
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        },
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
})      
