import test from "node:test";
import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "../workers/portfolio/index.mjs";
import { DEFAULTS } from "../src/lib/wardrobe/core.mjs";

test("Wardrobe gates the shared Key behind Access and rebuilds billable requests", async (t) => {
  const origin = "https://www.xuweinan.com";
  const issuer = "https://mock-team.cloudflareaccess.com";
  const audience = "wardrobe-app";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256" };
  function token(aud, exp = "5m") {
    return new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(issuer)
      .setAudience(aud)
      .setSubject("test-user")
      .setExpirationTime(exp)
      .sign(privateKey);
  }
  const validToken = await token(audience);
  const env = {
    OPENAI_API_KEY: "mock-service-key",
    WARDROBE_ACCESS_ISSUER: issuer,
    WARDROBE_ACCESS_AUD: audience,
    WARDROBE_RATE_LIMIT: { limit: async ({ key }) => ({ success: key === "test-user" }) },
    ASSETS: { fetch: async () => new Response("static asset") },
  };
  const upstream = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url) === issuer + "/cdn-cgi/access/certs")
      return Response.json({ keys: [jwk] });
    upstream.push({ url, ...init });
    return Response.json({ data: [{ id: DEFAULTS.tagModel }, { id: "unrelated" }] });
  });

  function call(path, { accessToken, headers, ...options } = {}, bindings = env) {
    return worker.fetch(new Request(origin + path, {
      ...options,
      headers: { ...(accessToken ? { "Cf-Access-Jwt-Assertion": accessToken } : {}), ...headers },
    }), bindings);
  }
  const models = "/api/wardrobe/models";
  assert.equal(await (await call("/tools/wardrobe/")).text(), "static asset");
  assert.equal((await call(models, {}, { ...env, OPENAI_API_KEY: "" })).status, 503);
  assert.equal((await call(models)).status, 401);
  assert.equal((await call(models, { accessToken: await token("another-app") })).status, 401);
  assert.equal((await call(models, { accessToken: await token(audience, 1) })).status, 401);
  assert.equal((await call("/api/wardrobe/files", { accessToken: validToken })).status, 404);
  assert.equal((await call("/api/wardrobe/session?login=1", { accessToken: validToken })).headers.get("Location"), "/tools/wardrobe/");
  assert.equal(upstream.length, 0);

  assert.deepEqual(await (await call(models, { accessToken: validToken })).json(), { data: [{ id: DEFAULTS.tagModel }] });
  const tags = "/api/wardrobe/responses";
  const input = [{
    content: [{ text: "识别衣服。" }, { image_url: "data:image/jpeg;base64,YQ==" }],
  }];
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    accessToken: validToken,
    body: JSON.stringify({ model: "injected", tools: [{ type: "web_search" }], input }),
  };
  assert.equal((await call(tags, { ...options, headers: { Origin: "https://elsewhere.example" } })).status, 403);
  assert.equal((await call(tags, options, { ...env, WARDROBE_RATE_LIMIT: { limit: async () => ({ success: false }) } })).status, 429);
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
    accessToken: validToken, method: "POST", headers: { Origin: origin }, body: form,
  })).status, 200);
  assert.equal(upstream[2].body.get("model"), DEFAULTS.imageModel);
  assert.equal(upstream[2].body.get("n"), null);
});
