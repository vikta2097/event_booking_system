const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Verify that a valid JWT token is provided.
 * Attaches the decoded user payload to req.user.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token missing.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ message: 'Invalid or session expired.' });
    req.user = user; // { id, email, role }
    next();
  });
}

/**
 * Verify that the user has the 'admin' role.
 */
function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Admin access required.' });
  }
  next();
}

/**
 * Verify that the user has the 'organizer' role.
 */
function verifyOrganizer(req, res, next) {
  if (!req.user || req.user.role !== 'organizer') {
    return res.status(403).json({ message: 'Forbidden. Organizer access required.' });
  }
  next();
}

/**
 * General-purpose middleware to verify one or more allowed roles.
 * Usage: verifyRole('admin', 'organizer')
 */
function verifyRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden. Access denied.' });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyOrganizer,
  verifyRole
};
