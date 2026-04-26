const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const { redis } = require("../config/redis");

const MOVIES_CACHE_VERSION_KEY = "cache:movies:list:version";

const closeRedis = async () => {
  if (typeof redis.quit === "function") {
    await redis.quit();
    return;
  }

  if (typeof redis.disconnect === "function") {
    redis.disconnect();
  }
};

const bootstrapRedis = async () => {
  try {
    const pingResult = await redis.ping();
    console.info("Redis ping successful:", pingResult);

    const existingVersion = await redis.get(MOVIES_CACHE_VERSION_KEY);

    if (!existingVersion) {
      await redis.set(MOVIES_CACHE_VERSION_KEY, "1");
      console.info(`Created Redis key: ${MOVIES_CACHE_VERSION_KEY}=1`);
    } else {
      console.info(
        `Redis key already exists: ${MOVIES_CACHE_VERSION_KEY}=${String(existingVersion)}`
      );
    }

    console.info(
      "Refresh-session keys are created automatically during admin login, so no extra Redis tables or keys are required."
    );
  } catch (error) {
    console.error("Redis bootstrap failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closeRedis();
  }
};

bootstrapRedis();
