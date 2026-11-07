const DAILY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

// Each IP has its own object. Synchronous storage keeps the read and write
// together, even when multiple requests arrive at the same time.
export function consumeDailyQuota(storage, now) {
  const day = Math.floor((now + BEIJING_OFFSET_MS) / DAY_MS);
  const record = storage.get("quota");
  const count = record?.day === day ? record.count : 0;
  if (count >= DAILY_LIMIT) {
    const midnight = (day + 1) * DAY_MS - BEIJING_OFFSET_MS;
    return Math.ceil((midnight - now) / 1000);
  }
  storage.put("quota", { day, count: count + 1 });
  return 0;
}
