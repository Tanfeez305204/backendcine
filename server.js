const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const compression = require("compression");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const { testDatabaseConnection } = require("./config/db");
const { redis } = require("./config/redis");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth.routes");
const moviesRoutes = require("./routes/movies.routes");
const uploadRoutes = require("./routes/upload.routes");

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDevelopment = process.env.NODE_ENV !== "production";
const devOriginPatterns = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https?:\/\/10(?:\.\d{1,3}){3}(?::\d+)?$/i,
  /^https?:\/\/192\.168(?:\.\d{1,3}){2}(?::\d+)?$/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}(?::\d+)?$/i
];
const publicReadPathPatterns = [
  /^\/api\/health$/i,
  /^\/api\/categories$/i,
  /^\/api\/movies(?:\/[^/]+)?$/i
];

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isDevelopment && devOriginPatterns.some((pattern) => pattern.test(origin))) {
    return true;
  }

  return false;
};

const hasPrivilegedCorsHeaders = (req) => {
  const requestedHeaders = (req.header("Access-Control-Request-Headers") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return requestedHeaders.includes("authorization") || Boolean(req.header("Authorization"));
};

const isPublicReadRequest = (req) => {
  const method = (req.method || "").toUpperCase();

  return (
    ["GET", "HEAD"].includes(method) &&
    publicReadPathPatterns.some((pattern) => pattern.test(req.path)) &&
    !hasPrivilegedCorsHeaders(req)
  );
};

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(compression());
app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");

    if (!origin || isOriginAllowed(origin)) {
      callback(null, {
        origin: true,
        credentials: true
      });
      return;
    }

    if (isPublicReadRequest(req)) {
      callback(null, {
        origin: true,
        credentials: false
      });
      return;
    }

    const error = new Error("Origin not allowed by CORS.");
    error.statusCode = 403;
    error.errors = [{ field: "origin", message: "Origin not allowed by CORS." }];
    callback(error);
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CineStream API is healthy.",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

app.use("/api", authRoutes);
app.use("/api", moviesRoutes);
app.use("/api", uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await testDatabaseConnection();

    try {
      await redis.ping();
      console.info("Redis ping successful.");
    } catch (error) {
      console.warn("Redis ping failed. The API will continue without cache/session guarantees.");
    }

    app.listen(port, () => {
      console.info(`CineStream backend running on port ${port}.`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
