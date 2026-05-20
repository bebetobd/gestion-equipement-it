/**
 * Session and activity monitoring
 */

import { insertActivityLog } from './db.js';

export const activeSessions = new Map();  // userId → session info
export const tokenToUserId = new Map();   // token → userId

const activityLog = [];
let activityCounter = 0;

/**
 * Get client IP address from request
 * @param {object} req - Express request
 * @returns {string} Client IP or 'N/A'
 */
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'N/A'
  );
}

/**
 * Log user activity
 * @param {number} userId - User ID
 * @param {string} username - Username
 * @param {string} name - User full name
 * @param {string} action - Action performed
 * @param {string} details - Action details
 * @param {string} ip - Client IP
 */
export function logActivity(userId, username, name, action, details, ip) {
  activityCounter++;
  const entry = {
    id: activityCounter,
    userId,
    username: username || '?',
    name: name || '?',
    action,
    details: details || '',
    timestamp: new Date().toISOString(),
    ip: ip || 'N/A'
  };
  
  activityLog.unshift(entry);

  // Keep only last 500 entries
  if (activityLog.length > 500) {
    activityLog.pop();
  }

  // Persist to DB (non-blocking)
  insertActivityLog({ userId, username, userName: name, action, details, ip }).catch(() => {});

  console.log(`[ACTIVITY] ${action} - User: ${username} - IP: ${ip}`);
}

/**
 * Get activity log (with pagination)
 * @param {number} userId - Filter by user ID (optional)
 * @param {number} limit - Limit results
 * @returns {array} Activity log entries
 */
export function getActivityLog(userId = null, limit = 100) {
  let result = activityLog;
  
  if (userId) {
    result = result.filter(entry => entry.userId === userId);
  }
  
  return result.slice(0, limit);
}

/**
 * Get all active sessions
 * @returns {array} Array of session objects
 */
export function getActiveSessions() {
  return Array.from(activeSessions.values());
}

/**
 * Create session entry
 * @param {object} sessionData - Session data
 */
export function createSession(sessionData) {
  activeSessions.set(sessionData.userId, sessionData);
}

/**
 * Clear user sessions and tokens
 * @param {number} userId - User ID
 */
export function clearUserSessions(userId) {
  // Remove from active sessions
  activeSessions.delete(userId);
  
  // Remove all tokens for this user
  for (const [token, uid] of tokenToUserId.entries()) {
    if (uid === userId) {
      tokenToUserId.delete(token);
    }
  }
}

/**
 * Clear all sessions and tokens (useful for logout or admin force logout)
 */
export function clearAllSessions() {
  activeSessions.clear();
  tokenToUserId.clear();
}
