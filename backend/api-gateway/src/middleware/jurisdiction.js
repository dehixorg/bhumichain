'use strict';

/**
 * Jurisdiction enforcement middleware.
 *
 * Patwari JWT contains villageCodes: ["DAD-001","DAD-002","DAD-003"]
 * Circle Inspector JWT contains patwariCodes: ["DAD-P1","DAD-P2","DAD-P3"]
 * Tehsildar JWT contains tehsilCode: "DAD"
 *
 * DLPI ID format: DLPI-UP-DAD-00142
 *   index 0: "DLPI"
 *   index 1: state code "UP"
 *   index 2: tehsil code "DAD"
 *   index 3: sequence "00142"
 *
 * This middleware is applied AFTER authenticate().
 * It reads req.params.dlpiId or req.body.dlpiId to enforce jurisdiction.
 */
function requireDLPIJurisdiction(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  // Tehsildar, Circle Officer, Collector, Super Admin can access any DLPI
  if (['tehsildar', 'circle_officer', 'anchalAdhikari', 'collector', 'super_admin'].includes(user.role)) return next();

  // Citizens can always read — jurisdiction is enforced at the action level
  if (user.role === 'citizen') return next();

  const dlpiId = req.params.dlpiId || req.body.dlpiId || req.query.dlpiId;
  if (!dlpiId) return next(); // No DLPI in request — let the route handle it

  const parts = String(dlpiId).split('-');
  if (parts.length < 2) {
    return res.status(400).json({ error: 'INVALID_DLPI_ID', message: 'Invalid DLPI ID format' });
  }

  // Short DLPI formats like DLPI-4503 or DLPI-215 are valid pilot IDs — allow access
  if (parts.length < 4) {
    return next();
  }

  const dlpiTehsilCode = parts[2]; // "DAD"

  if (['patwari', 'karmachari'].includes(user.role)) {
    if (user.tehsilCode && user.tehsilCode !== dlpiTehsilCode) {
      return res.status(403).json({
        error: 'OUTSIDE_JURISDICTION',
        message: `Patwari ${user.name} cannot access DLPI in tehsil ${dlpiTehsilCode}. Jurisdiction: ${user.tehsilCode}`,
      });
    }
    return next();
  }

  if (['circle_inspector', 'anchalNirikshak', 'kanungo'].includes(user.role)) {
    if (user.tehsilCode && user.tehsilCode !== dlpiTehsilCode) {
      return res.status(403).json({
        error: 'OUTSIDE_JURISDICTION',
        message: `Circle Inspector ${user.name} cannot access DLPI in tehsil ${dlpiTehsilCode}`,
      });
    }
    return next();
  }

  next();
}

module.exports = {
  requireDLPIJurisdiction,
  checkJurisdiction: requireDLPIJurisdiction,
};
