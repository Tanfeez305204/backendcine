const multer = require("multer");

const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  error.errors = [
    {
      field: "route",
      message: `Route not found: ${req.originalUrl}`
    }
  ];

  next(error);
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error.";
  let errors = Array.isArray(error.errors) ? error.errors : [];

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    statusCode = 400;
    message = "Invalid JSON payload.";
    errors = [{ field: "body", message: "Request body contains invalid JSON." }];
  }

  if (error instanceof multer.MulterError) {
    statusCode = 400;
    message = "File upload failed.";
    errors = [{ field: error.field || "file", message: error.message }];
  }

  if (error.code === "23505") {
    statusCode = 409;
    message = "Resource already exists.";
    errors = [{ field: "database", message: error.detail || error.message }];
  }

  if (error.code === "22P02") {
    statusCode = 400;
    message = "Invalid parameter value.";
    errors = [{ field: "database", message: error.message }];
  }

  if (!errors.length) {
    errors = [{ field: "general", message }];
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
