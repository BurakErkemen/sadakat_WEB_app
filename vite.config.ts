import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    // vendor-firebase (~700 KB) ve QRScanner (~340 KB) bilinçli olarak büyük:
    // ikisi de initial yükte DEĞİL, yalnızca ihtiyaç anında dinamik iner.
    // Varsayılan 500 KB uyarı eşiği bu lazy vendor chunk'ları için yükseltildi.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
})
