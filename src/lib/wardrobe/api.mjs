import { personalApiKey, validateTags, responseText } from "./core.mjs";
import { imageRequestBody, tagRequestBody } from "./request-body.mjs";
const BASE = "https://api.openai.com/v1";

export async function request(path, config, options = {}, timeoutMs = 240000) {
  const useWorker = config.apiMode === "default";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetch((useWorker ? "/api/wardrobe" : BASE) + path, {
        ...options,
        signal: controller.signal,
        ...(useWorker
          ? { redirect: "manual" }
          : { headers: { ...options.headers, Authorization: `Bearer ${personalApiKey(config)}` } }),
      });
    } catch (e) {
      throw new Error(
        e.name === "AbortError"
          ? "请求超时，请稍后重试。"
          : "连接 OpenAI 失败，请检查网络。",
      );
    }
    if (useWorker && (r.type === "opaqueredirect" || r.status === 404))
      throw new Error("默认模式暂不可用，可切换到 BYOK。");
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
export async function listModels(config) {
  const d = await request("/models", config, {}, 15000);
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
  const heic =
    /^image\/hei[cf](?:-sequence)?$/i.test(file.type) ||
    /\.hei[cf]$/i.test(file.name);
  const standard =
    /^image\/(jpeg|png|webp)$/i.test(file.type) ||
    ((!file.type || file.type === "application/octet-stream") &&
      /\.(jpe?g|png|webp)$/i.test(file.name));
  if (!heic && !standard)
    throw new Error("请选择 JPEG、PNG、WebP、HEIC 或 HEIF 图片。");
  const url = URL.createObjectURL(file);
  let bitmap;
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (error) {
      if (!heic) throw error;
      const { heicTo } = await import("heic-to/csp");
      bitmap = await heicTo({ blob: file, type: "bitmap" });
    }
    const width = bitmap?.width ?? img.naturalWidth;
    const height = bitmap?.height ?? img.naturalHeight;
    const scale = Math.min(1, 2048 / Math.max(width, height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * scale));
    c.height = Math.max(1, Math.round(height * scale));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap ?? img, 0, 0, c.width, c.height);
    return await new Promise((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片转换失败。"))),
        "image/jpeg",
        0.92,
      ),
    );
  } catch {
    throw new Error(
      heic
        ? "此 HEIC 图片无法读取，请尝试重新导出为 JPEG。"
        : "此图片无法读取，请尝试重新选择或导出为 JPEG。",
    );
  } finally {
    bitmap?.close();
    URL.revokeObjectURL(url);
  }
}
export async function generateImage(original, config) {
  const d = await request("/images/edits", config, {
    method: "POST",
    body: imageRequestBody(original, {
      ...config,
      imageModel: config.apiMode === "default" ? config.defaultImageModel : config.imageModel,
    }),
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
  const d = await request("/responses", config, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tagRequestBody(image, {
      ...config,
      tagModel: config.apiMode === "default" ? config.defaultTagModel : config.tagModel,
    })),
  });
  return validateTags(JSON.parse(responseText(d)));
}
