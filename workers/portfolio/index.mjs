import { DurableObject } from "cloudflare:workers";
import { consumeDailyQuota } from "./wardrobe-quota.mjs";

export { default } from "./handler.mjs";

export class WardrobeDailyQuota extends DurableObject {
  consume() {
    return consumeDailyQuota(this.ctx.storage.kv, Date.now());
  }
}
