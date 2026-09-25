import { redisConnection } from "../config/redis";

const HOUR_MS = 60 * 60 * 1000;

// Atomically increments two counters (global + per-sender) for the current
// hour window and only commits the increment if BOTH stay within their
// limits. If either would be exceeded, nothing is incremented (both
// counters are rolled back) so we never under/over count across concurrent
// workers. Keys auto-expire after ~2 windows so Redis stays clean.
const RESERVE_SLOT_LUA = `
local globalKey = KEYS[1]
local senderKey = KEYS[2]
local globalLimit = tonumber(ARGV[1])
local senderLimit = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local globalCount = tonumber(redis.call('GET', globalKey) or '0')
local senderCount = tonumber(redis.call('GET', senderKey) or '0')

if globalCount >= globalLimit or senderCount >= senderLimit then
  return 0
end

redis.call('INCR', globalKey)
redis.call('EXPIRE', globalKey, ttlSeconds)
redis.call('INCR', senderKey)
redis.call('EXPIRE', senderKey, ttlSeconds)
return 1
`;

function hourWindowStart(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

export function nextHourWindowStart(ts: number): number {
  return hourWindowStart(ts) + HOUR_MS;
}

/**
 * Attempts to reserve one send slot for `senderEmail` in the current hour
 * window. Returns true if the send may proceed now, false if either the
 * global or per-sender hourly limit has been reached (caller should
 * reschedule into the next hour window).
 */
export async function tryReserveHourlySlot(
  senderEmail: string,
  globalLimit: number,
  senderLimit: number,
  now: number = Date.now()
): Promise<boolean> {
  const window = hourWindowStart(now);
  const globalKey = `ratelimit:global:${window}`;
  const senderKey = `ratelimit:sender:${senderEmail}:${window}`;

  const result = (await redisConnection.eval(
    RESERVE_SLOT_LUA,
    2,
    globalKey,
    senderKey,
    String(globalLimit),
    String(senderLimit),
    String(Math.ceil((2 * HOUR_MS) / 1000))
  )) as number;

  return result === 1;
}
