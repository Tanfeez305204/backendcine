const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const {
  createMovieRecord,
  deleteMovieRecord,
  getMovie,
  getMovieCategories,
  getMovies,
  updateMovieRecord
} = require("../controllers/movies.controller");
const { attachAdminIfPresent, authenticateAdmin } = require("../middleware/auth");
const { adminLimiter, publicLimiter } = require("../middleware/rateLimit");

const router = express.Router();

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

const moviePayloadValidators = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required.")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters."),
  body("language")
    .notEmpty()
    .withMessage("Language is required.")
    .isIn(["Hindi Dubbed", "South Dubbed", "English", "Bollywood", "Multi Audio"])
    .withMessage(
      "Language must be one of Hindi Dubbed, South Dubbed, English, Bollywood, or Multi Audio."
    ),
  body("year")
    .notEmpty()
    .withMessage("Year is required.")
    .isInt({ min: 1900, max: 2030 })
    .withMessage("Year must be between 1900 and 2030."),
  body("rating")
    .notEmpty()
    .withMessage("Rating is required.")
    .isFloat({ min: 0, max: 10 })
    .withMessage("Rating must be a number between 0 and 10."),
  body("genre")
    .notEmpty()
    .withMessage("Genre is required.")
    .custom((value) => {
      const genres = String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (!genres.length) {
        throw new Error("Genre must contain at least one tag.");
      }

      return true;
    }),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required.")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters."),
  body("thumbnail_url")
    .optional({ values: "falsy" })
    .isURL()
    .withMessage("Thumbnail URL must be a valid URL."),
  body("watch_url")
    .trim()
    .notEmpty()
    .withMessage("Watch URL is required.")
    .isURL()
    .withMessage("Watch URL must be a valid URL."),
  body("is_published")
    .optional()
    .isBoolean()
    .withMessage("is_published must be a boolean value.")
];

const movieUpdateValidators = [
  body().custom((value) => {
    const editableFields = [
      "title",
      "language",
      "year",
      "rating",
      "genre",
      "description",
      "thumbnail_url",
      "watch_url",
      "is_published"
    ];

    const hasAtLeastOneField = editableFields.some((field) => value[field] !== undefined);

    if (!hasAtLeastOneField) {
      throw new Error("At least one updatable field must be provided.");
    }

    return true;
  }),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters."),
  body("language")
    .optional()
    .isIn(["Hindi Dubbed", "South Dubbed", "English", "Bollywood", "Multi Audio"])
    .withMessage(
      "Language must be one of Hindi Dubbed, South Dubbed, English, Bollywood, or Multi Audio."
    ),
  body("year")
    .optional()
    .isInt({ min: 1900, max: 2030 })
    .withMessage("Year must be between 1900 and 2030."),
  body("rating")
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage("Rating must be a number between 0 and 10."),
  body("genre")
    .optional()
    .custom((value) => {
      const genres = String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (!genres.length) {
        throw new Error("Genre must contain at least one tag.");
      }

      return true;
    }),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters."),
  body("thumbnail_url")
    .optional({ values: "falsy" })
    .isURL()
    .withMessage("Thumbnail URL must be a valid URL."),
  body("watch_url")
    .optional()
    .trim()
    .isURL()
    .withMessage("Watch URL must be a valid URL."),
  body("is_published")
    .optional()
    .isBoolean()
    .withMessage("is_published must be a boolean value.")
];

router.get(
  "/movies",
  publicLimiter,
  attachAdminIfPresent,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer."),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100."),
    query("lang")
      .optional({ values: "falsy" })
      .isIn(["Hindi Dubbed", "South Dubbed", "English", "Bollywood", "Multi Audio"])
      .withMessage(
        "lang must be one of Hindi Dubbed, South Dubbed, English, Bollywood, or Multi Audio."
      ),
    query("search")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search must be between 1 and 100 characters."),
    query("year")
      .optional({ values: "falsy" })
      .isInt({ min: 1900, max: 2030 })
      .withMessage("Year must be between 1900 and 2030."),
    query("sortBy")
      .optional({ values: "falsy" })
      .isIn(["title", "year", "created_at"])
      .withMessage("sortBy must be one of title, year, or created_at."),
    query("sortOrder")
      .optional({ values: "falsy" })
      .isIn(["asc", "desc"])
      .withMessage("sortOrder must be either asc or desc."),
    query("isPublished")
      .optional({ values: "falsy" })
      .isIn(["true", "false"])
      .withMessage("isPublished must be either true or false.")
  ],
  handleValidationErrors,
  getMovies
);

router.get(
  "/movies/:id",
  publicLimiter,
  attachAdminIfPresent,
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Movie id must be a positive integer.")
  ],
  handleValidationErrors,
  getMovie
);

router.get(
  "/categories",
  publicLimiter,
  [query().custom(() => true)],
  handleValidationErrors,
  getMovieCategories
);

router.post(
  "/admin/movies",
  adminLimiter,
  authenticateAdmin,
  moviePayloadValidators,
  handleValidationErrors,
  createMovieRecord
);

router.put(
  "/admin/movies/:id",
  adminLimiter,
  authenticateAdmin,
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Movie id must be a positive integer."),
    ...movieUpdateValidators
  ],
  handleValidationErrors,
  updateMovieRecord
);

router.delete(
  "/admin/movies/:id",
  adminLimiter,
  authenticateAdmin,
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Movie id must be a positive integer.")
  ],
  handleValidationErrors,
  deleteMovieRecord
);

module.exports = router;
