# 🚀 Guide de Démarrage Rapide

## Installation

### Prérequis
- Node.js 16+ ([Télécharger](https://nodejs.org))
- PostgreSQL 12+ ([Télécharger](https://www.postgresql.org)) ou Neon/Railway
- npm ou yarn

### Étape 1 : Cloner et installer

```bash
# Windows
setup.bat

# macOS/Linux
bash setup.sh

# Ou manuellement
npm install
cp .env.example .env
```

### Étape 2 : Configuration

Éditer `.env` avec vos paramètres :

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/gestion_it

# JWT Secret (générer une chaîne aléatoire longue en production)
JWT_SECRET=your-super-secret-key-min-32-chars

# URL API frontend
VITE_API_BASE_URL=http://localhost:4000
```

### Étape 3 : Initialiser les utilisateurs

```bash
npm run init-users
```

Cela crée 3 comptes de test:
- `admin` / `admin2024` → Accès complet
- `technicien` / `tech2024` → Lecture seule
- `utilisateur` / `user2024` → Lecture seule

### Étape 4 : Lancer le projet

```bash
# Mode développement (frontend + backend)
npm run dev:all

# Ou séparément:
# Terminal 1
npm run backend

# Terminal 2
npm run dev
```

## 🌐 Accès

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Santé | http://localhost:4000/health |

## 📦 Structure du Projet

```
.
├── src/                      # React TypeScript frontend
│   ├── App.tsx              # Composant principal
│   ├── LoginPage.tsx        # Page de connexion
│   ├── ITEquipmentManager.tsx # Gestion des équipements
│   ├── config.ts            # Configuration et utilitaires API
│   └── index.css            # Styles Tailwind
├── server/                   # Express backend
│   ├── app.js               # Routes API
│   ├── server.js            # Serveur Express
│   ├── db.js                # PostgreSQL connexion
│   ├── middleware.js        # Middleware (auth, erreurs)
│   ├── monitoring.js        # Sessions et activités
│   ├── validation.js        # Validateurs d'entrée
│   ├── data/                # Données JSON initiales
│   └── init-users.js        # Script d'initialisation
├── .env.example             # Variables d'environnement (exemple)
├── .env                     # Variables d'environnement (local)
├── package.json             # Dépendances
├── tsconfig.json            # Configuration TypeScript
├── vite.config.ts           # Configuration Vite
├── tailwind.config.js       # Configuration Tailwind
└── IMPROVEMENTS.md          # Documentation des améliorations

```

## 🔐 Authentification

L'application utilise **JWT (JSON Web Token)** pour l'authentification:

1. Utilisateur se connecte avec username/password
2. Serveur retourne un JWT valable 8 heures
3. Token stocké dans localStorage
4. Chaque requête API inclut le token dans le header Authorization
5. Sessions trackées en mémoire côté serveur

### Récupérer le token programmatiquement

```typescript
import { getAuthHeaders, apiUrl } from '@/config';

const headers = getAuthHeaders(); // Retourne { Authorization: 'Bearer token' }
const response = await fetch(apiUrl('/api/equipments'), {
  headers
});
```

## 🔑 Permissions

Trois niveaux de permissions:

| Permission | Description | Rôles |
|-----------|-------------|-------|
| `lecture` | Consulter équipements | admin, technicien, user |
| `ecriture` | Ajouter équipements | admin |
| `modification` | Modifier/supprimer | admin |

Chaque utilisateur a un tableau `permissions` dans son JWT.

## 📊 API Endpoints

### Authentification
```
POST   /api/auth/login         # Connexion
GET    /api/auth/me            # Info utilisateur courant
POST   /api/auth/logout        # Déconnexion
```

### Utilisateurs (admin only)
```
GET    /api/users              # Liste utilisateurs
POST   /api/users              # Créer utilisateur
PUT    /api/users/:id          # Modifier utilisateur
DELETE /api/users/:id          # Supprimer utilisateur
```

### Équipements
```
GET    /api/equipments         # Liste équipements
POST   /api/equipments         # Ajouter équipement
PUT    /api/equipments/:id     # Modifier équipement
DELETE /api/equipments/:id     # Supprimer équipement
GET    /api/equipments/export  # Exporter CSV
```

### Admin
```
GET    /api/admin/sessions     # Sessions actives
GET    /api/admin/activities   # Historique activités
```

## 🧪 Tests

### Test de connexion
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin2024"}'
```

### Test avec token
```bash
TOKEN="eyJ0eXAi..." # Token récupéré ci-dessus

curl http://localhost:4000/api/equipments \
  -H "Authorization: Bearer $TOKEN"
```

### Test validation
```bash
# Cela devrait échouer (username trop court)
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"ab","name":"Test","role":"user","password":"short"}'
```

## 🛠️ Développement

### Ajouter une nouvelle route

1. **Créer la route dans `server/app.js`:**
```javascript
app.post('/api/new-endpoint', authenticate, requirePermission('lecture'), 
  asyncHandler(async (req, res) => {
    // Validation
    const validation = validateData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }
    
    try {
      // Logique
      const result = await query('SELECT ...');
      logActivity(req.user.id, req.user.username, req.user.name, 
        'Action', 'Details', getClientIp(req));
      res.json(result);
    } catch (err) {
      handleError(err, res, 'Erreur message');
    }
  })
);
```

2. **Ajouter un validateur si nécessaire dans `server/validation.js`:**
```javascript
export function validateNewData(data) {
  const errors = [];
  // Validations...
  return { valid: errors.length === 0, errors };
}
```

3. **Utiliser le nouvel endpoint depuis React:**
```typescript
import { apiUrl, getAuthHeaders } from '@/config';

const response = await fetch(apiUrl('/api/new-endpoint'), {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify(data)
});
```

### Logs et Debugging

Les logs sont affichés dans la console serveur:

```
[ACTIVITY] Connexion - User: admin - IP: 127.0.0.1
[REQUEST] POST /api/users - 201 (145ms)
[ERROR] Error: Database connection failed
```

## 🐳 Docker (optionnel)

```bash
# Lancer avec Docker Compose
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

## 📈 Production

### Déployer sur Vercel

1. Connecter le repo à Vercel
2. Configurer les variables d'environnement:
   - `DATABASE_URL` (PostgreSQL)
   - `JWT_SECRET` (générer avec `openssl rand -hex 32`)
3. `npm run build`
4. `npm start`

### Checklist production

- [ ] JWT_SECRET changé et long (32+ caractères)
- [ ] DATABASE_URL pointant vers base sécurisée
- [ ] NODE_ENV=production
- [ ] CORS configuré correctement
- [ ] HTTPS activé
- [ ] Rate limiting configuré
- [ ] Logs centralisés (Winston, DataDog, etc.)
- [ ] Backups automatiques base de données
- [ ] Monitoring des erreurs (Sentry, etc.)

## 🆘 Troubleshooting

### Port 4000/5173 déjà utilisé
```bash
# Windows - Trouver le processus
netstat -ano | findstr :4000

# Linux/Mac
lsof -i :4000
```

### Base de données non accessible
```bash
# Vérifier DATABASE_URL dans .env
# Tester connexion
psql $DATABASE_URL -c "SELECT 1"
```

### Token expiré
- Tokens JWT expirent après 8h
- Utilisateur doit se reconnecter
- Réduire `JWT_EXPIRES_IN` si nécessaire

### CORS issues
Vérifier que `VITE_API_BASE_URL` est correct dans `.env`

## 📚 Documentation Supplémentaire

- [IMPROVEMENTS.md](IMPROVEMENTS.md) - Documentation des améliorations
- [.env.example](.env.example) - Variables d'environnement
- [package.json](package.json) - Dépendances

## 📝 License

MIT

## 👨‍💻 Support

Pour les issues ou questions, créer une issue sur le repo.
