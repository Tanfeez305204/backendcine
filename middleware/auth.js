const jwt = require("jsonwebtoken");

const buildAuthError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  error.errors = [{ field: "authorization", message }];
  return error;
};

const authenticateAdmin = (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return next(buildAuthError("Authorization token is required."));
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return next(buildAuthError("Authorization token is required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.admin = {
      id: decoded.adminId,
      email: decoded.email
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(buildAuthError("Access token has expired."));
    }

    return next(buildAuthError("Invalid access token."));
  }
};

const attachAdminIfPresent = (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return next();
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.admin = {
      id: decoded.adminId,
      email: decoded.email
    };

    return next();
  } catch (error) {
    return next();
  }
};

module.exports = {
  authenticateAdmin,
  attachAdminIfPresent
};
