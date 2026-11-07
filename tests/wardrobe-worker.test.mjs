import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/portfolio/handler.mjs";
import { consumeDailyQuota } from "../workers/portfolio/wardrobe-quota.mjs";
import { DEFAULTS } from "../src/lib/wardrobe/core.mjs";

test("Wardrobe shares the 100-request quota across endpoints for each IP", async (t) => {
  const origin = "https://www.xuweinan.com";
  const ip = "192.0.2.1";
  const stores = new Map();
  let now = Date.parse("2026-11-08T15:59:59.500Z");
  const env = {
    OPENAI_API_KEY: "mock-service-key",
    WARDROBE_DAILY_QUOTA: {
      getByName(name) {
        if (!stores.has(name)) {
          const values = new Map();
          stores.set(name, { get: key => values.get(key), put: (key, value) => values.set(key, value) });
        }
        return { consume: async () => consumeDailyQuota(stores.get(name), now) };
      },
    },
    ASSETS: { fetch: async () => new Response("static asset") },
  };
  const upstream = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    upstream.push({ url, ...init });
    return Response.json({ data: [{ id: DEFAULTS.tagModel }, { id: "unrelated" }] });
  });

  function call(path, { address = ip, headers, ...options } = {}, bindings = env) {
    return worker.fetch(new Request(origin + path, {
      ...options,
      headers: { ...(address ? { "CF-Connecting-IP": address } : {}), ...headers },
    }), bindings);
  }
  const models = "/api/wardrobe/models";
  assert.equal(await (await call("/tools/wardrobe/")).text(), "static asset");
  assert.equal((await call(models, {}, { ...env, OPENAI_API_KEY: "" })).status, 503);
  assert.equal((await call(models, { address: "", headers: { "X-Forwarded-For": ip } })).status, 403);
  assert.equal((await call("/api/wardrobe/files")).status, 404);
  assert.equal((await call("/api/wardrobe/status")).status, 200);
  assert.equal(stores.size, 0);
  assert.equal(upstream.length, 0);

  assert.deepEqual(await (await call(models)).json(), { data: [{ id: DEFAULTS.tagModel }] });
  const tags = "/api/wardrobe/responses";
  const input = [{
    content: [{ text: "识别衣服。" }, { image_url: "data:image/jpeg;base64,YQ==" }],
  }];
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ model: "injected", tools: [{ type: "web_search" }], input }),
  };
  assert.equal((await call(tags, { ...options, headers: { Origin: "https://elsewhere.example" } })).status, 403);
  assert.equal(upstream.length, 1);

  assert.equal((await call(tags, options)).status, 200);
  const payload = JSON.parse(upstream[1].body);
  assert.equal(payload.model, DEFAULTS.tagModel);
  assert.equal(payload.store, false);
  assert.equal(payload.tools, undefined);
  assert.equal(upstream[1].headers.Authorization, "Bearer mock-service-key");

  const form = new FormData();
  form.set("image", new Blob(["test image"], { type: "image/jpeg" }), "garment.jpg");
  form.set("prompt", "去除背景。");
  form.set("model", "injected");
  form.set("n", "99");
  assert.equal((await call("/api/wardrobe/images/edits", {
    method: "POST", headers: { Origin: origin }, body: form,
  })).status, 200);
  assert.equal(upstream[2].body.get("model"), DEFAULTS.imageModel);
  assert.equal(upstream[2].body.get("n"), null);
  for (let count = 3; count < 100; count++)
    assert.equal((await call(models)).status, 200);
  const denied = await call(tags, options);
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("Retry-After"), "1");
  assert.equal(upstream.length, 100);

  assert.equal((await call(models, { address: "192.0.2.2" })).status, 200);
  now += 500;
  assert.equal((await call(models)).status, 200);

});
