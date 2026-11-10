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

function error(status, message, headers = {}, code) {
  return Response.json({ error: { message, code } }, { status, headers: { ...noCache, ...headers } });
}

function boundedBody(request, limit = MAX_BODY_BYTES) {
  let bytes = 0;
  const limited = request.body?.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limit) {
        controller.error(new RangeError("Body too large"));
      } else {
        controller.enqueue(chunk);
      }
    },
  }));
  return new Response(limited, { headers: request.headers });
}

async function imageBadRequest(response, headers) {
  const { error: upstream } = (await boundedBody(response, 16384).json().catch(() => null)) ?? {};
  if (typeof upstream?.code === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(upstream.code))
    headers["X-Wardrobe-Upstream-Code"] = upstream.code;
  if (upstream?.code === "moderation_blocked") {
    const stage = upstream.moderation_details?.moderation_stage;
    const code = stage === "input" ? "moderation_input" : stage === "output" ? "moderation_output" : "moderation_blocked";
    const message = stage === "output"
      ? "生成的透明图未通过 OpenAI 审核。可调整图片 Prompt 后重试。"
      : "这次请求未通过 OpenAI 审核。可检查原图和图片 Prompt 后再试。";
    return error(400, message, headers, code);
  }
  if (["invalid_image", "invalid_image_format", "invalid_image_dimensions", "image_too_large", "image_too_small"].includes(upstream?.code)) {
    return error(400, "OpenAI 无法处理这张原图。请换一张照片或重新导出为 JPEG 后上传。", headers, "invalid_image");
  }
  if (["invalid_value", "unsupported_value", "missing_required_parameter"].includes(upstream?.code)) {
    return error(400, "OpenAI 拒绝了透明图生成参数。请导出处理日志以便排查。", headers, "invalid_parameter");
  }
  return error(400, "OpenAI 拒绝了这次透明图请求。若再次失败，请导出处理日志。", headers, "upstream_bad_request");
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
      }, data.get("output_format") === "webp" ? "webp" : "png"),
    };
  }
  const data = await body.json();
  const content = Array.isArray(data?.input)
    ? data.input.find((message) => message?.role === "user")?.content
    : null;
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
      return error(429, "今日默认模式额度已用完。每个 IP 每天限 100 次请求。", {
        "Retry-After": String(retryAfter),
      }, "daily_quota_exhausted");

    try {
      const response = await fetch(OPENAI + path, {
        ...payload,
        method: request.method,
        // Workers supports manual redirects; the !response.ok check below rejects them.
        redirect: "manual",
        headers: { ...payload.headers, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        const diagnostics = { "X-Wardrobe-Upstream-Status": String(response.status) };
        const requestId = response.headers.get("x-request-id");
        if (/^req_[a-z0-9]{8,64}$/i.test(requestId ?? ""))
          diagnostics["X-Wardrobe-Upstream-Request-Id"] = requestId;
        if (path === "/images/edits" && response.status === 400)
          return await imageBadRequest(response, diagnostics);
        await response.body?.cancel();
        return response.status === 429
          ? error(429, "默认模式额度不足或请求过于频繁，请稍后重试。", diagnostics)
          : error(502, "OpenAI 未能完成请求，请重试或切换到 BYOK。", diagnostics);
      }
      if (path === "/models") {
        const { data } = await response.json();
        return Response.json({ data: data.filter(({ id }) => modelIds.has(id)).map(({ id }) => ({ id })) }, { headers: noCache });
      }
      return new Response(response.body, {
        headers: { ...noCache, "Content-Type": "application/json" },
      });
    } catch {
      return error(502, "默认模式暂时无法连接 OpenAI，请稍后重试。", { "X-Wardrobe-Upstream-Error": "connection" });
    }
  },
};
