import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Disajikan sebagai path di domain utama (budd.my.id/qr), bukan subdomain.
  // base wajib supaya asset di-request ke /qr/assets/... bukan /assets/...
  base: '/qr/',
  plugins: [react()],
})
