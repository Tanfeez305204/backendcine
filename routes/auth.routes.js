const express = require("express");
const { body, validationResult } = require("express-validator");
const { login, logout, refresh } = require("../controllers/auth.controller");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();
const refreshCookieName = process.env.REFRESH_COOKIE_NAME || "cinestream_refresh_token";

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(422).json({
    success: false,
    message: "Validation failed.",
    errors: errors.array().map((error) => ({
      field: error.path || "body",
      message: error.msg
    }))
  });
};

router.post(
  "/auth/login",
  authLimiter,
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required.")
      .isEmail()
      .withMessage("Please provide a valid email address."),
    body("password")
      .notEmpty()
      .withMessage("Password is required.")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long.")
  ],
  handleValidationErrors,
  login
);

router.post(
  "/auth/refresh",
  authLimiter,
  [
    body("refreshToken")
      .optional({ values: "falsy" })
      .isString()
      .withMessage("Refresh token must be a string."),
    body().custom((value, { req }) => {
      if (!req.body.refreshToken && !req.cookies?.[refreshCookieName]) {
        throw new Error("Refresh token is required in the request body or cookie.");
      }

      return true;
    })
  ],
  handleValidationErrors,
  refresh
);

router.post(
  "/auth/logout",
  authLimiter,
  [
    body("refreshToken")
      .optional({ values: "falsy" })
      .isString()
      .withMessage("Refresh token must be a string when provided.")
  ],
  handleValidationErrors,
  logout
);

module.exports = router;
