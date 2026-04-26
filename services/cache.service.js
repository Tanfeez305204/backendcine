const { isRedisReady, redis } = require("../config/redis");

const MOVIES_CACHE_VERSION_KEY = "cache:movies:list:version";
const MOVIES_CACHE_TTL_SECONDS = 10 * 60;
const REFRESH_SESSION_PREFIX = "auth:refresh:";

const normalizeCachePayload = (payload) => {
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return entries.length
    ? entries.map(([key, value]) => `${key}:${String(value)}`).join("|")
    : "all";
};

const ensureMoviesCacheVersion = async () => {
  try {
    if (!isRedisReady()) {
      return "1";
    }

    let version = await redis.get(MOVIES_CACHE_VERSION_KEY);

    if (!version) {
      version = "1";
      await redis.set(MOVIES_CACHE_VERSION_KEY, version);
    }

    return version;
  } catch (error) {
    return "1";
  }
};

const getMoviesCacheKey = async (payload) => {
  try {
    const version = await ensureMoviesCacheVersion();
    const serialized = normalizeCachePayload(payload);
    return `movies:list:v${version}:${serialized}`;
  } catch (error) {
    return `movies:list:fallback:${Date.now()}`;
  }
};

const getCache = async (key) => {
  try {
    if (!isRedisReady()) {
      return null;
    }

    const cachedValue = await redis.get(key);
    return cachedValue ? JSON.parse(cachedValue) : null;
  } catch (error) {
    return null;
  }
};

const setCache = async (key, value, ttlSeconds = MOVIES_CACHE_TTL_SECONDS) => {
  try {
    if (!isRedisReady()) {
      return false;
    }

    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch (error) {
    return false;
  }
};

const invalidateMovieListCache = async () => {
  try {
    if (!isRedisReady()) {
      return false;
    }

    const exists = await redis.exists(MOVIES_CACHE_VERSION_KEY);

    if (!exists) {
      await redis.set(MOVIES_CACHE_VERSION_KEY, "1");
    }

    await redis.incr(MOVIES_CACHE_VERSION_KEY);
    return true;
  } catch (error) {
    return false;
  }
};

const storeRefreshSession = async (jti, payload, ttlSeconds) => {
  try {
    if (!isRedisReady()) {
      return false;
    }

    await redis.set(
      `${REFRESH_SESSION_PREFIX}${jti}`,
      JSON.stringify(payload),
      "EX",
      ttlSeconds
    );

    return true;
  } catch (error) {
    return false;
  }
};

const getRefreshSession = async (jti) => {
  try {
    if (!isRedisReady()) {
      return null;
    }

    const session = await redis.get(`${REFRESH_SESSION_PREFIX}${jti}`);
    return session ? JSON.parse(session) : null;
  } catch (error) {
    return null;
  }
};

const invalidateRefreshSession = async (jti) => {
  try {
    if (!isRedisReady()) {
      return false;
    }

    await redis.del(`${REFRESH_SESSION_PREFIX}${jti}`);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  MOVIES_CACHE_TTL_SECONDS,
  getMoviesCacheKey,
  getCache,
  setCache,
  invalidateMovieListCache,
  storeRefreshSession,
  getRefreshSession,
  invalidateRefreshSession
};
