'use strict';

module.exports = function requireScope() {
  const requiredScopes = Array.prototype.slice.call(arguments);

  return function (req, res, next) {
    if (!req.tokenPayload || !req.tokenPayload.scope) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: 'No scope information in token',
        required_scope: requiredScopes.join(' ')
      });
    }

    const grantedScopes = req.tokenPayload.scope.split(' ');
    const missing = requiredScopes.filter(function (s) {
      return !grantedScopes.includes(s);
    });

    if (missing.length > 0) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: 'Missing required scope(s): ' + missing.join(', '),
        required_scope: requiredScopes.join(' '),
        granted_scope: req.tokenPayload.scope
      });
    }

    next();
  };
};
