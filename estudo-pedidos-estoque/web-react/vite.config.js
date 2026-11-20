import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O proxy encaminha /api para a API Node, então o front-end não precisa de CORS no desenvolvimento.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
