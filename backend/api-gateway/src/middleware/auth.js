'use strict';

const jwt = require('jsonwebtoken');

const ROLES = {
  CITIZEN:          'citizen',
  PATWARI:          'patwari',
  CIRCLE_INSPECTOR: 'circle_inspector',
  TEHSILDAR:        'tehsildar',
  KOTWAL:           'kotwal',
  // Production roles — wired but not demoed
  SRO:              'sro',
  COLLECTOR:        'collector',
  BANK:             'bank',
  NALSA:            'nalsa',
  ORACLE:           'oracle',
  SUPER_ADMIN:      'super_admin',
};

const OFFICER_ROLES = ['patwari', 'circle_inspector', 'tehsildar', 'kotwal', 'sro', 'collector', 'super_admin'];
const CAN_CREATE_DLPI    = ['patwari', 'tehsildar', 'collector', 'super_admin'];
const CAN_APPROVE_MUTATION = ['circle_inspector', 'tehsildar', 'collector', 'super_admin'];

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: e.message });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', required: roles, current: req.user.role });
    }
    next();
  };
}

function mintToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '8h',
  });
}

function issueDemoToken(role, name, extra = {}) {
  if (process.env.FABRIC_MODE !== 'mock') {
    throw new Error('Demo tokens only available in mock mode');
  }
  return mintToken({ role, name, demo: true, ...extra });
}

module.exports = {
  authenticate,
  requireRole,
  mintToken,
  issueDemoToken,
  ROLES,
  OFFICER_ROLES,
  CAN_CREATE_DLPI,
  CAN_APPROVE_MUTATION,
};
