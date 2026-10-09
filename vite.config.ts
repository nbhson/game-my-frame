import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // dev (5173) proxy API + realtime về LAN server (8931): chạy `npm run dev`
    // kèm `npm run server` thì save xe/đồ mới vào được DB, không rớt local
    proxy: {
      '/api': 'http://localhost:8931',
      '/socket.io': { target: 'http://localhost:8931', ws: true },
    },
  },
});
