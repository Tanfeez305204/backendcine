const { EventEmitter } = require("events");
const Redis = require("ioredis");

const sharedOptions = {
  enableReadyCheck: true,
  maxRetriesPerRequest: 1,
  lazyConnect: false
};

const rawRedisUrl = String(process.env.REDIS_URL || "").trim();
const upstashRestUrl = String(
  process.env.UPSTASH_REDIS_REST_URL ||
    (rawRedisUrl.startsWith("redis:https://") || rawRedisUrl.startsWith("redis:http://")
      ? rawRedisUrl.replace(/^redis:/i, "")
      : /^https?:\/\//i.test(rawRedisUrl)
        ? rawRedisUrl
        : "")
).trim();
const upstashRestToken = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const tcpRedisUrl =
  /^(redis|rediss):\/\//i.test(rawRedisUrl) && !/^redis:https?:\/\//i.test(rawRedisUrl)
    ? rawRedisUrl
    : "";

class UpstashRestRedis extends EventEmitter {
  constructor(url, token) {
    super();
    this.url = url.replace(/\/+$/g, "");
    this.token = token;
    this.status = "wait";

    if (!this.url || !this.token) {
      this.status = "end";
      return;
    }

    setImmediate(async () => {
      try {
        await this.ping();
        this.status = "ready";
        this.emit("connect");
      } catch (error) {
        this.status = "end";
        this.emit("error", error);
      }
    });
  }

  async command(commandName, ...args) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([commandName, ...args])
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.error) {
      const error = new Error(
        payload.error || `Upstash Redis request failed with status ${response.status}.`
      );
      throw error;
    }

    return payload.result;
  }

  async ping() {
    return this.command("PING");
  }

  async get(key) {
    return this.command("GET", key);
  }

  async set(key, value, mode, ttlSeconds) {
    if (mode !== undefined && ttlSeconds !== undefined) {
      return this.command("SET", key, value, mode, ttlSeconds);
    }

    return this.command("SET", key, value);
  }

  async exists(key) {
    return this.command("EXISTS", key);
  }

  async incr(key) {
    return this.command("INCR", key);
  }

  async del(key) {
    return this.command("DEL", key);
  }

  async quit() {
    this.status = "end";
    return "OK";
  }

  disconnect() {
    this.status = "end";
  }
}

const redis =
  upstashRestUrl && upstashRestToken
    ? new UpstashRestRedis(upstashRestUrl, upstashRestToken)
    : tcpRedisUrl
      ? new Redis(tcpRedisUrl, sharedOptions)
      : new Redis({
          host: "127.0.0.1",
          port: 6379,
          ...sharedOptions
        });

redis.on("connect", () => {
  console.info("Redis connection established.");
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

const isRedisReady = () => redis.status === "ready";

module.exports = {
  redis,
  isRedisReady
};
