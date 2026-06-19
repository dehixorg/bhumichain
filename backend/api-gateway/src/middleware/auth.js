'use strict';

const jwt = require('jsonwebtoken');

// Roles used in Fabric endorsement policy mirror
const ROLES = {
  CITIZEN: 'citizen',
  REVENUE_OFFICER: 'revenue_officer',
  CIRCLE_OFFICER: 'circle_officer',
  SRO: 'sro',
  COLLECTOR: 'collector',
  NALSA: 'nalsa',
  BANK: 'bank',
  ORACLE: 'oracle',   // internal: oracle service calls
};

/**
 * Middleware: verify JWT and attach user to req.user.
 * In mock mode, still validates token but accepts demo tokens signed with
 * the dev secret so demo flow works without a real auth service.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header required' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: e.message });
  }
}

/**
 * Middleware factory: require one of the listed roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
}

/**
 * Issue a demo JWT — used by POST /api/auth/demo-token in mock mode only.
 * Allows the demo frontend to get any role token without a real IdP.
 */
function issueDemoToken(role, name, aadhaarHash) {
  if (process.env.FABRIC_MODE !== 'mock') {
    throw new Error('Demo tokens only available in mock mode');
  }
  return jwt.sign(
    { role, name, aadhaarHash, demo: true },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '8h' },
  );
}

module.exports = { authenticate, requireRole, issueDemoToken, ROLES };
