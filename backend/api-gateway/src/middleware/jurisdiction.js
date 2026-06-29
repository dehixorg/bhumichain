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

  // Tehsildar and above can touch any DLPI in their tehsil — no extra check needed
  if (['tehsildar', 'collector', 'super_admin'].includes(user.role)) return next();

  // Citizens can always read — jurisdiction is enforced at the action level
  if (user.role === 'citizen') return next();

  const dlpiId = req.params.dlpiId || req.body.dlpiId || req.query.dlpiId;
  if (!dlpiId) return next(); // No DLPI in request — let the route handle it

  const parts = dlpiId.split('-');
  if (parts.length < 4) {
    return res.status(400).json({ error: 'INVALID_DLPI_ID', message: 'Expected format: DLPI-UP-DAD-00142' });
  }

  const dlpiTehsilCode = parts[2]; // "DAD"

  if (user.role === 'patwari') {
    // Patwari must match tehsil code (village-level check requires DLPI record lookup — done in chaincode)
    if (user.tehsilCode && user.tehsilCode !== dlpiTehsilCode) {
      return res.status(403).json({
        error: 'OUTSIDE_JURISDICTION',
        message: `Patwari ${user.name} cannot access DLPI in tehsil ${dlpiTehsilCode}. Jurisdiction: ${user.tehsilCode}`,
      });
    }
    return next();
  }

  if (user.role === 'circle_inspector') {
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
