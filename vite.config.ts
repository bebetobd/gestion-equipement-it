import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
  ,build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) return 'vendor_leaflet';
            if (id.includes('html2canvas')) return 'vendor_html2canvas';
            if (id.includes('jspdf-autotable')) return 'vendor_jspdf_autotable';
            if (id.includes('jspdf')) return 'vendor_jspdf';
            if (id.includes('xlsx')) return 'vendor_xlsx';
            if (id.includes('docx')) return 'vendor_docx';
            if (id.includes('jsbarcode')) return 'vendor_jsbarcode';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor_react';
            return 'vendor_misc';
          }
        }
      }
    }
  }
});
