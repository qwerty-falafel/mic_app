import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: 'frontend', plugins: [react()], build: { outDir: 'dist', emptyOutDir: true }, server: { host: '127.0.0.1', port: 5173, proxy: Object.fromEntries(['/health','/system','/projects','/repositories','/work-items','/runs','/questions','/approvals','/evidence','/resources','/scheduler'].map(path => [path, 'http://127.0.0.1:3100'])) } });
