import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { app } from './app.js';
import { initDB } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const distPath = path.join(__dirname, '..', 'dist');

// Check JWT_SECRET at startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-to-a-random-secret-in-production') {
  console.error('FATAL: JWT_SECRET must be set to a strong random value in production.');
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Warn about default passwords
if (!process.env.DEFAULT_ADMIN_PASSWORD) {
  console.warn('⚠️  Default admin passwords are in use. Set DEFAULT_ADMIN_PASSWORD / DEFAULT_TECH_PASSWORD / DEFAULT_USER_PASSWORD env vars.');
}

// Serve the built frontend in production (local only)
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Initialize database at startup
try {
  await initDB();
  console.log('Base de données initialisée.');
} catch (err) {
  console.error('Erreur d\'initialisation de la base de données:', err);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  if (existsSync(distPath)) {
    console.log(`Interface disponible sur http://localhost:${PORT}`);
  } else {
    console.log('Dossier dist/ introuvable — lancez "npm run build" pour le générer.');
  }
});
