import { CATEGORIES, validateTags, responseText } from "./core.mjs";
const BASE = "https://api.openai.com/v1";
export async function request(path, key, options = {}, timeoutMs = 240000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetch(BASE + path, {
        ...options,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, ...options.headers },
      });
    } catch (e) {
      throw new Error(
        e.name === "AbortError"
          ? "请求超时，请稍后重试。"
          : "连接 OpenAI 失败，请检查网络。",
      );
    }
    let data;
    try {
      data = await r.json();
    } catch {
      throw new Error("OpenAI 返回无法读取的响应。");
    }
    if (!r.ok)
      throw new Error(data.error?.message ?? `请求失败（${r.status}）`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export async function listModels(key) {
  const d = await request("/models", key, {}, 15000);
  return (d.data ?? []).map((m) => m.id).sort();
}
export function dataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("无法读取图片。"));
    r.readAsDataURL(blob);
  });
}
export async function prepareImage(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error("单张图片不能超过 30 MB。");
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type))
    throw new Error(
      "请选择 JPEG、PNG 或 WebP 图片。HEIC 请在设备上转换后重试。",
    );
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      1,
      2048 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片转换失败。"))),
        "image/jpeg",
        0.92,
      ),
    );
  } catch {
    throw new Error("此图片无法解码，请改用 JPEG、PNG 或 WebP。");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function generateImage(original, config) {
  const form = new FormData();
  form.append("image", original, "garment.jpg");
  form.append("model", config.imageModel);
  form.append("prompt", config.imagePrompt);
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append(
    "size",
    /^gpt-image-(2|2\.5)(?:-|$)/.test(config.imageModel)
      ? "2048x2048"
      : "1024x1024",
  );
  form.append("quality", "high");
  const d = await request("/images/edits", config.apiKey, {
    method: "POST",
    body: form,
  });
  const b64 = d.data?.[0]?.b64_json;
  if (!b64) throw new Error("模型没有返回 PNG 图片，请检查图像模型。");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  try {
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let alpha = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 255) {
        alpha = true;
        break;
      }
    }
    if (!alpha) throw new Error("生成图片没有透明区域，请重试或调整 Prompt。");
  } finally {
    bitmap.close();
  }
  return blob;
}
export async function generateTags(original, config) {
  const image = await dataURL(original);
  const d = await request("/responses", config.apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.tagModel,
      store: false,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: config.tagPrompt },
            { type: "input_image", image_url: image, detail: "auto" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "clothing_tags",
          strict: true,
          schema: {
            type: "object",
            properties: {
              coarse: { type: "string", enum: CATEGORIES },
              fine: { type: "array", items: { type: "string" } },
            },
            required: ["coarse", "fine"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  return validateTags(JSON.parse(responseText(d)));
}
