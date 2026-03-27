const jwt = require('jsonwebtoken');
const Group = require('../models/groupModel');

const requireProfileAuth = (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authorization token is required.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'replace-with-secure-secret';
    const decoded = jwt.verify(token, jwtSecret);

    req.profileAuth = {
      itNumber: decoded.itNumber,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authorization token.' });
  }
};

const requireMatchingProfileIt = (req, res, next) => {
  const routeItNumber = String(req.params.itNumber || '').trim().toUpperCase();

  if (!req.profileAuth || req.profileAuth.itNumber !== routeItNumber) {
    return res.status(403).json({ message: 'You can only access your own groups.' });
  }

  return next();
};

const requireGroupMemberAccess = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const isMember = group.members.some((member) => member.itNumber === req.profileAuth.itNumber);

    if (!isMember) {
      return res.status(403).json({ message: 'You are not allowed to modify this group.' });
    }

    req.targetGroup = group;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requireProfileAuth,
  requireMatchingProfileIt,
  requireGroupMemberAccess,
};
