const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { normalizeSupabaseError, supabase } = require("../config/db");
const {
  getRefreshSession,
  invalidateRefreshSession,
  storeRefreshSession
} = require("../services/cache.service");

const refreshCookieName = process.env.REFRESH_COOKIE_NAME || "cinestream_refresh_token";

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  maxAge: Number(process.env.REFRESH_TOKEN_COOKIE_MAX_AGE || 604800000),
  path: "/api/auth"
});

const signAccessToken = (admin) =>
  jwt.sign(
    {
      adminId: admin.id,
      email: admin.email
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m"
    }
  );

const signRefreshToken = (admin, jti) =>
  jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      jti
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
    }
  );

const serializeAdmin = (admin) => ({
  id: admin.id,
  email: admin.email,
  created_at: admin.created_at
});

const getIncomingRefreshToken = (req) =>
  req.cookies?.[refreshCookieName] || req.body.refreshToken || null;

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, email, password_hash, created_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (adminError) {
      throw normalizeSupabaseError(adminError, "Failed to fetch admin account.");
    }

    if (!admin) {
      const error = new Error("Invalid email or password.");
      error.statusCode = 401;
      error.errors = [{ field: "email", message: "Invalid email or password." }];
      throw error;
    }
    const passwordMatches = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatches) {
      const error = new Error("Invalid email or password.");
      error.statusCode = 401;
      error.errors = [{ field: "password", message: "Invalid email or password." }];
      throw error;
    }

    const accessToken = signAccessToken(admin);
    const jti = randomUUID();
    const refreshToken = signRefreshToken(admin, jti);

    await storeRefreshSession(
      jti,
      { adminId: admin.id, email: admin.email },
      Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 604800)
    );

    res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        accessToken,
        refreshToken,
        admin: serializeAdmin(admin)
      }
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = getIncomingRefreshToken(req);

    if (!refreshToken) {
      const error = new Error("Refresh token is required.");
      error.statusCode = 401;
      error.errors = [{ field: "refreshToken", message: "Refresh token is required." }];
      throw error;
    }

    let decoded;

    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (tokenError) {
      const error = new Error("Invalid refresh token.");
      error.statusCode = 401;
      error.errors = [{ field: "refreshToken", message: "Invalid refresh token." }];
      throw error;
    }

    const session = await getRefreshSession(decoded.jti);

    if (!session || Number(session.adminId) !== Number(decoded.adminId)) {
      const error = new Error("Refresh session is invalid or expired.");
      error.statusCode = 401;
      error.errors = [
        {
          field: "refreshToken",
          message: "Refresh session is invalid or expired."
        }
      ];
      throw error;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, email, created_at")
      .eq("id", Number(decoded.adminId))
      .maybeSingle();

    if (adminError) {
      throw normalizeSupabaseError(adminError, "Failed to fetch admin account.");
    }

    if (!admin) {
      const error = new Error("Admin account not found.");
      error.statusCode = 404;
      error.errors = [{ field: "admin", message: "Admin account not found." }];
      throw error;
    }

    const accessToken = signAccessToken(admin);
    const nextJti = randomUUID();
    const nextRefreshToken = signRefreshToken(admin, nextJti);

    await invalidateRefreshSession(decoded.jti);
    await storeRefreshSession(
      nextJti,
      { adminId: admin.id, email: admin.email },
      Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 604800)
    );

    res.cookie(refreshCookieName, nextRefreshToken, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      message: "Access token refreshed successfully.",
      data: {
        accessToken,
        refreshToken: nextRefreshToken,
        admin: serializeAdmin(admin)
      }
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = getIncomingRefreshToken(req);

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        await invalidateRefreshSession(decoded.jti);
      } catch (error) {
        await Promise.resolve();
      }
    }

    res.clearCookie(refreshCookieName, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      message: "Logout successful.",
      data: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout
};
