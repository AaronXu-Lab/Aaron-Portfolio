import { createRemoteJWKSet, jwtVerify } from "jose";
import { DEFAULTS } from "../../src/lib/wardrobe/core.mjs";
import { imageRequestBody, tagRequestBody } from "../../src/lib/wardrobe/request-body.mjs";

const PREFIX = "/api/wardrobe";
const OPENAI = "https://api.openai.com/v1";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const METHODS = new Map([
  ["/session", "GET"],
  ["/models", "GET"],
  ["/images/edits", "POST"],
  ["/responses", "POST"],
]);
const noCache = { "Cache-Control": "no-store" };
const modelIds = new Set([DEFAULTS.imageModel, DEFAULTS.tagModel]);
const validImageType = /^image\/(jpeg|png|webp)$/i;
const validImageURL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
let jwks;

function error(status, message) {
  return Response.json({ error: { message } }, { status, headers: noCache });
}

async function accessUser(request, issuer, audience) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))
    return null;
  if (jwks?.issuer !== issuer) {
    jwks = {
      issuer,
      keys: createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer)),
    };
  }
  try {
    const { payload } = await jwtVerify(token, jwks.keys, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp"],
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

function boundedBody(request) {
  let bytes = 0;
  const limited = request.body?.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        controller.error(new RangeError("Body too large"));
      } else {
        controller.enqueue(chunk);
      }
    },
  }));
  return new Response(limited, { headers: request.headers });
}

function validPrompt(prompt) {
  return typeof prompt === "string" && prompt.trim().length > 0 && prompt.length <= 10000;
}

async function upstreamPayload(path, request) {
  const body = boundedBody(request);
  if (path === "/images/edits") {
    const data = await body.formData();
    const image = data.get("image");
    const prompt = data.get("prompt");
    if (!(image instanceof Blob) || !image.size || !validImageType.test(image.type) || !validPrompt(prompt))
      return null;
    return { body: imageRequestBody(image, { ...DEFAULTS, imagePrompt: prompt }) };
  }
  const data = await body.json();
  const content = data?.input?.[0]?.content;
  const prompt = content?.[0]?.text;
  const image = content?.[1]?.image_url;
  if (!validPrompt(prompt) || typeof image !== "string" || !validImageURL.test(image))
    return null;
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...tagRequestBody(image, { ...DEFAULTS, tagPrompt: prompt }),
      max_output_tokens: 4096,
    }),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(PREFIX + "/")) return env.ASSETS.fetch(request);

    const path = url.pathname.slice(PREFIX.length);
    if (!METHODS.has(path)) return error(404, "此接口不存在。");
    if (METHODS.get(path) !== request.method) return error(405, "请求方式不受支持。");
    if (request.method === "POST" && request.headers.get("Origin") !== url.origin)
      return error(403, "请求来源不受支持。");

    const { OPENAI_API_KEY: key, WARDROBE_ACCESS_ISSUER: issuer, WARDROBE_ACCESS_AUD: audience } = env;
    if (!key || !issuer || !audience) return error(503, "默认模式暂未配置，可切换到 BYOK。");
    const user = await accessUser(request, issuer, audience);
    if (!user) return error(401, "请在衣集设置中登录默认模式。");
    if (path === "/session") {
      if (url.searchParams.get("login") === "1")
        return new Response(null, { status: 303, headers: { ...noCache, Location: "/tools/wardrobe/" } });
      return Response.json({ ok: true }, { headers: noCache });
    }

    const limit = await env.WARDROBE_RATE_LIMIT.limit({ key: user });
    if (!limit.success) return error(429, "请求过于频繁，请稍后重试。");

    let payload = {};
    if (request.method === "POST") {
      if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES)
        return error(413, "照片文件过大。");
      try {
        payload = await upstreamPayload(path, request);
      } catch (cause) {
        if (cause instanceof RangeError) return error(413, "照片文件过大。");
        return error(400, "无法读取请求内容。");
      }
      if (!payload) return error(400, "请检查照片格式和 Prompt。");
    }

    try {
      const response = await fetch(OPENAI + path, {
        ...payload,
        method: request.method,
        redirect: "error",
        headers: { ...payload.headers, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        await response.body?.cancel();
        return response.status === 429
          ? error(429, "默认模式额度不足或请求过于频繁，请稍后重试。")
          : error(502, "OpenAI 未能完成请求，请重试或切换到 BYOK。");
      }
      if (path === "/models") {
        const { data } = await response.json();
        return Response.json({ data: data.filter(({ id }) => modelIds.has(id)).map(({ id }) => ({ id })) }, { headers: noCache });
      }
      return new Response(response.body, {
        headers: { ...noCache, "Content-Type": "application/json" },
      });
    } catch {
      return error(502, "默认模式暂时无法连接 OpenAI，请稍后重试。");
    }
  },
};
