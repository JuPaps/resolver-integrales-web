import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Configuración de Vite: https://vite.dev/config/
export default defineConfig({
  base: '/resolver-integrales-web/',
  plugins: [
    tailwindcss(),
    react()
  ],
})
