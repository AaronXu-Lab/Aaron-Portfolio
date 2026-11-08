import { DEFAULT_MODE_MODELS, defaultModeModel } from "../../src/lib/wardrobe/core.mjs";
import { imageRequestBody, tagRequestBody } from "../../src/lib/wardrobe/request-body.mjs";

const PREFIX = "/api/wardrobe";
const OPENAI = "https://api.openai.com/v1";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const METHODS = new Map([
  ["/status", "GET"],
  ["/models", "GET"],
  ["/images/edits", "POST"],
  ["/responses", "POST"],
]);
const noCache = { "Cache-Control": "no-store" };
const modelIds = new Set([...DEFAULT_MODE_MODELS.image, ...DEFAULT_MODE_MODELS.tags]);
const validImageType = /^image\/(jpeg|png|webp)$/i;
const validImageURL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function error(status, message, headers = {}) {
  return Response.json({ error: { message } }, { status, headers: { ...noCache, ...headers } });
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
    return {
      body: imageRequestBody(image, {
        imageModel: defaultModeModel("image", data.get("model")),
        imagePrompt: prompt,
      }),
    };
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
      ...tagRequestBody(image, {
        tagModel: defaultModeModel("tags", data.model),
        tagPrompt: prompt,
      }),
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

    const key = env.OPENAI_API_KEY;
    if (!key) return error(503, "默认模式暂未配置，可切换到 BYOK。");
    if (path === "/status") return Response.json({ ok: true }, { headers: noCache });

    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return error(403, "无法识别访问 IP，可切换到 BYOK。");

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

    let retryAfter;
    try {
      retryAfter = await env.WARDROBE_DAILY_QUOTA.getByName(ip).consume();
    } catch {
      return error(503, "暂时无法检查默认模式用量，请稍后重试。");
    }
    if (retryAfter > 0)
      return error(429, "当前 IP 今日已用完 100 次默认模式请求。北京时间零点重置，也可切换到 BYOK。", {
        "Retry-After": String(retryAfter),
      });

    try {
      const response = await fetch(OPENAI + path, {
        ...payload,
        method: request.method,
        // Workers supports manual redirects; the !response.ok check below rejects them.
        redirect: "manual",
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
