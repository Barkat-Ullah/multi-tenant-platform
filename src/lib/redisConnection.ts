/**
 * Re-export from redis.ts for backward compatibility.
 * All helpers import from "redisConnection" — this bridge avoids
 * having to update every import path.
 */
export * from './redis';
import redis from './redis';
export { redis };
export default redis;