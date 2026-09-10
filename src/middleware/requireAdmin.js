/**
 * Must run after auth middleware. Rejects any request whose token role
 * isn't ADMIN. This is the server-side enforcement — the frontend hiding
 * a button is not a substitute for this check.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

module.exports = requireAdmin;
