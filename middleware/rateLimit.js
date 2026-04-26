const rateLimit = require("express-rate-limit");

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        errors: [
          {
            field: "rateLimit",
            message
          }
        ]
      });
    }
  });

const publicLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many public requests. Please try again in 15 minutes."
});

const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many admin requests. Please try again in 15 minutes."
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many authentication attempts. Please try again in 15 minutes."
});

module.exports = {
  publicLimiter,
  adminLimiter,
  authLimiter
};
