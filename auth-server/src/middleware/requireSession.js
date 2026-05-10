'use strict';

module.exports = function requireSession(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'authentication_required',
      error_description: 'You must be logged in to perform this action'
    });
  }
  next();
};
