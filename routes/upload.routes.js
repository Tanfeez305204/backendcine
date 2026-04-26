const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { uploadThumbnail } = require("../controllers/upload.controller");
const { authenticateAdmin } = require("../middleware/auth");
const { adminLimiter } = require("../middleware/rateLimit");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files are allowed.");
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  }
});

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

const runUpload = (req, res, next) => {
  upload.single("thumbnail")(req, res, (error) => {
    if (error) {
      return next(error);
    }

    return next();
  });
};

router.post(
  "/upload/thumbnail",
  adminLimiter,
  authenticateAdmin,
  runUpload,
  [
    body().custom((value, { req }) => {
      if (!req.file) {
        throw new Error("Thumbnail image file is required.");
      }

      return true;
    })
  ],
  handleValidationErrors,
  uploadThumbnail
);

module.exports = router;
