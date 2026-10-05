import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 127.0.0.1 on purpose: "localhost" can resolve to the IPv6 address only, which some Windows setups refuse.
    // `npm run dev:lan` (vite --host) overrides this to listen on the network for phones.
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
