import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { app } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const distPath = path.join(__dirname, '..', 'dist');

// Serve the built frontend in production (local only)
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  if (existsSync(distPath)) {
    console.log(`Interface disponible sur http://localhost:${PORT}`);
  } else {
    console.log('Dossier dist/ introuvable — lancez "npm run build" pour le générer.');
  }
});
