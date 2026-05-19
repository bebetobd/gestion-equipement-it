/**
 * Express middleware and utility functions
 */

import jwt from 'jsonwebtoken';
import { activeSessions, tokenToUserId, logActivity } from './monitoring.js';

/**
 * Centralized error handler
 * @param {Error} err - Error object
 * @param {object} res - Express response
 * @param {string} message - User-friendly message
 */
export function handleError(err, res, message = 'Erreur serveur') {
  console.error('Error:', err.message || err);
  
  if (err.code === '23505') {
    return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
  }
  
  if (err.code === '23503') {
    return res.status(400).json({ message: 'Invalid reference' });
  }
  
  res.status(500).json({ message });
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token manquant. Veuillez vous connecter.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'gestion-it-secret-2024';
    req.user = jwt.verify(token, jwtSecret);
    req.token = token;
    
    if (activeSessions.has(req.user.id)) {
      activeSessions.get(req.user.id).lastSeen = new Date().toISOString();
    }
    
    next();
  } catch (err) {
    const userId = tokenToUserId.get(token);
    if (userId) {
      const s = activeSessions.get(userId);
      logActivity(userId, s?.username, s?.name, 'Déconnexion', 'Session expirée automatiquement', 'N/A');
      activeSessions.delete(userId);
      tokenToUserId.delete(token);
    }
    res.status(401).json({ message: 'Token invalide ou expiré. Veuillez vous reconnecter.' });
  }
}

/**
 * Admin-only middleware
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Action réservée aux administrateurs.' });
  }
  next();
}

/**
 * Permission-based middleware
 * @param {string} permission - Required permission ('lecture', 'ecriture', 'modification')
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    
    const perms = req.user?.permissions || [];
    if (!perms.includes(permission)) {
      const labels = {
        lecture: 'Lecture',
        ecriture: 'Écriture',
        modification: 'Modification'
      };
      return res.status(403).json({
        message: `Permission "${labels[permission] || permission}" requise pour cette action.`
      });
    }
    next();
  };
}

/**
 * Validation middleware factory
 * @param {function} validatorFn - Validation function
 */
export function validateRequest(validatorFn) {
  return (req, res, next) => {
    const result = validatorFn(req.body);
    
    if (!result.valid) {
      return res.status(400).json({
        message: 'Validation error',
        errors: result.errors
      });
    }
    
    // Attach validated data
    req.validated = result;
    next();
  };
}

/**
 * Async error wrapper for route handlers
 * @param {function} fn - Async route handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const original = res.json;
  
  res.json = function(data) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    return original.call(this, data);
  };
  
  next();
}
