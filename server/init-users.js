import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersToCreate = [
  { id: 1, username: 'admin', password: 'admin2024', role: 'admin', name: 'Administrateur' },
  { id: 2, username: 'technicien', password: 'tech2024', role: 'technicien', name: 'Technicien IT' },
  { id: 3, username: 'utilisateur', password: 'user2024', role: 'user', name: 'Utilisateur' }
];

const hashed = await Promise.all(
  usersToCreate.map(async (u) => ({
    id: u.id,
    username: u.username,
    password: await bcrypt.hash(u.password, 10),
    role: u.role,
    name: u.name
  }))
);

await fs.writeFile(
  path.join(__dirname, 'data', 'users.json'),
  JSON.stringify(hashed, null, 2),
  'utf-8'
);

console.log('Utilisateurs créés avec succès !');
console.log('');
console.log('Identifiants disponibles :');
usersToCreate.forEach((u) =>
  console.log(`  Login: ${u.username.padEnd(12)} | Mot de passe: ${u.password.padEnd(12)} | Rôle: ${u.role}`)
);
