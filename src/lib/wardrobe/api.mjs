import { personalApiKey, validateTags, responseText } from "./core.mjs";
import { imageRequestBody, tagRequestBody, WEBP_QUALITY } from "./request-body.mjs";
const BASE = "https://api.openai.com/v1";

class ProcessingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function traceHeaders(trace, status, get, useWorker, details = {}) {
  if (!trace) return;
  const upstreamStatus = get("x-wardrobe-upstream-status");
  const upstreamRequestId = get(useWorker ? "x-wardrobe-upstream-request-id" : "x-request-id");
  const upstreamCode = get("x-wardrobe-upstream-code");
  const ray = get("cf-ray");
  trace("response_headers", {
    status,
    upstreamStatus: /^\d{3}$/.test(upstreamStatus ?? "") ? Number(upstreamStatus) : undefined,
    upstreamRequestId: /^req_[a-z0-9]{8,64}$/i.test(upstreamRequestId ?? "") ? upstreamRequestId : undefined,
    upstreamCode: /^[a-z][a-z0-9_]{1,63}$/.test(upstreamCode ?? "") ? upstreamCode : undefined,
    upstreamConnectionError: get("x-wardrobe-upstream-error") === "connection",
    ray: /^[a-f0-9]{16}-[A-Z]{3}$/.test(ray ?? "") ? ray : undefined,
    ...details,
  });
}

// Fetch doesn't expose upload progress. Use XHR only for opted-in BYOK processing.
function requestByokWithProgress(path, config, { body, method, headers, signal, trace }, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const xhr = new XMLHttpRequest();
    const started = performance.now();
    let phase = "before_upload", phaseStarted = started;
    let uploadedBytes = 0, uploadTotalBytes, downloadedBytes = 0, downloadTotalBytes;
    let lastProgress;
    const snapshot = () => {
      const now = performance.now();
      return {
        networkPhase: phase,
        requestElapsedMs: Math.round(now - started),
        phaseElapsedMs: Math.round(now - phaseStarted),
        sinceLastProgressMs: lastProgress === undefined ? undefined : Math.round(now - lastProgress),
        uploadedBytes, uploadTotalBytes, downloadedBytes, downloadTotalBytes,
      };
    };
    const enter = (next) => {
      phase = next;
      phaseStarted = performance.now();
      lastProgress = undefined;
    };
    const cancel = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", cancel);
    const failNetwork = (timedOut) => {
      cleanup();
      const reason = timedOut ? "timeout" : phase === "downloading" ? "response_interrupted" : "network_error";
      trace("request_failed", { ...snapshot(), reason });
      reject(new ProcessingError(reason, timedOut ? "请求超时，请稍后重试。" :
        phase === "downloading" ? "OpenAI 响应下载中断。" : "连接 OpenAI 失败，请检查网络。"));
    };
    const recordUpload = (event) => {
      if (event.lengthComputable) uploadTotalBytes = event.total;
      if (event.loaded <= uploadedBytes) return;
      uploadedBytes = event.loaded;
      if (phase === "before_upload") {
        enter("uploading");
        trace("upload_started", snapshot());
      }
      if (phase === "uploading") lastProgress = performance.now();
    };
    xhr.upload.addEventListener("progress", recordUpload);
    xhr.upload.addEventListener("load", (event) => {
      recordUpload(event);
      if (phase === "downloading") return;
      trace("upload_completed", snapshot());
      enter("awaiting_response");
    });
    const receivedHeaders = () => {
      if (!xhr.status || phase === "downloading") return;
      const before = snapshot();
      enter("downloading");
      traceHeaders(trace, xhr.status, (name) => xhr.getResponseHeader(name), false, {
        ...snapshot(),
        awaitingResponseMs: before.networkPhase === "awaiting_response" ? before.phaseElapsedMs : undefined,
      });
    };
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 2 || xhr.readyState === 3) receivedHeaders();
    };
    xhr.onprogress = (event) => {
      receivedHeaders();
      if (event.lengthComputable) downloadTotalBytes = event.total;
      if (event.loaded <= downloadedBytes) return;
      const first = downloadedBytes === 0;
      downloadedBytes = event.loaded;
      lastProgress = performance.now();
      if (first) trace("download_started", snapshot());
    };
    xhr.onload = (event) => {
      cleanup();
      receivedHeaders();
      downloadedBytes = Math.max(downloadedBytes, event.loaded);
      if (event.lengthComputable) downloadTotalBytes = event.total;
      trace("download_completed", snapshot());
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new ProcessingError("invalid_json", "OpenAI 返回无法读取的响应。"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ProcessingError("http_error", data?.error?.message ?? `请求失败（${xhr.status}）`));
        return;
      }
      trace("response_received");
      resolve(data);
    };
    xhr.onerror = () => failNetwork(false);
    xhr.ontimeout = () => failNetwork(true);
    xhr.onabort = () => {
      cleanup();
      if (signal?.aborted) reject(signal.reason);
      else failNetwork(false);
    };
    try {
      xhr.open(method, BASE + path);
      xhr.timeout = timeoutMs;
      for (const [name, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(name, value);
      xhr.setRequestHeader("Authorization", `Bearer ${personalApiKey(config)}`);
      signal?.addEventListener("abort", cancel, { once: true });
      trace("request_started", snapshot());
      xhr.send(body);
    } catch {
      failNetwork(false);
    }
  });
}

export async function request(path, config, options = {}, timeoutMs = 240000) {
  const { trace, ...init } = options;
  const useWorker = config.apiMode === "default";
  if (!useWorker && trace && init.method === "POST" && init.body && typeof XMLHttpRequest === "function")
    return requestByokWithProgress(path, config, options, timeoutMs);
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    trace?.("request_started");
    let r;
    try {
      r = await fetch((useWorker ? "/api/wardrobe" : BASE) + path, {
        ...init,
        signal: controller.signal,
        ...(useWorker
          ? { redirect: "manual" }
          : { headers: { ...options.headers, Authorization: `Bearer ${personalApiKey(config)}` } }),
      });
    } catch (e) {
      if (options.signal?.aborted) throw e;
      const timedOut = controller.signal.aborted;
      throw new ProcessingError(timedOut ? "timeout" : "network_error",
        timedOut
          ? "请求超时，请稍后重试。"
          : "连接 OpenAI 失败，请检查网络。",
      );
    }
    traceHeaders(trace, r.status, (name) => r.headers.get(name), useWorker);
    if (useWorker && (r.type === "opaqueredirect" || r.status === 404))
      throw new ProcessingError("worker_unavailable", "默认模式暂不可用，可切换到 BYOK。");
    let data;
    try {
      data = await r.json();
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (controller.signal.aborted)
        throw new ProcessingError("timeout", "请求超时，请稍后重试。");
      throw new ProcessingError(error instanceof SyntaxError ? "invalid_json" : "response_interrupted",
        "OpenAI 返回无法读取的响应。");
    }
    if (!r.ok)
      throw new ProcessingError((useWorker && data.error?.code) || "http_error", data.error?.message ?? `请求失败（${r.status}）`);
    trace?.("response_received");
    return data;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
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
export async function generateImage(original, config, signal, trace) {
  const d = await request("/images/edits", config, {
    method: "POST",
    signal,
    trace,
    body: imageRequestBody(original, {
      ...config,
      imageModel: config.apiMode === "default" ? config.defaultImageModel : config.imageModel,
    }),
  });
  signal?.throwIfAborted();
  const b64 = d.data?.[0]?.b64_json;
  if (!b64) throw new ProcessingError("missing_image", "模型没有返回图片，请检查图像模型。");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const header = String.fromCharCode(...bytes.subarray(0, 12));
  const isWebP = header.startsWith("RIFF") && header.slice(8) === "WEBP";
  const isPng = header.startsWith("\x89PNG\r\n\x1a\n");
  if (!isWebP && !isPng)
    throw new ProcessingError("invalid_image", "模型返回的图片不是 WebP 或 PNG。");
  const blob = new Blob([bytes], { type: isWebP ? "image/webp" : "image/png" });
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
    if (!alpha) throw new ProcessingError("missing_transparency", "生成图片没有透明区域，请重试或调整 Prompt。");
    if (!isWebP) {
      const webp = await new Promise((resolve) =>
        c.toBlob(resolve, "image/webp", WEBP_QUALITY / 100),
      );
      signal?.throwIfAborted();
      if (webp?.type === "image/webp" && webp.size < blob.size) return webp;
    }
  } finally {
    bitmap.close();
  }
  signal?.throwIfAborted();
  return blob;
}
export async function generateTags(original, config, signal, trace) {
  const image = await dataURL(original);
  const d = await request("/responses", config, {
    method: "POST",
    signal,
    trace,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tagRequestBody(image, {
      ...config,
      tagModel: config.apiMode === "default" ? config.defaultTagModel : config.tagModel,
    })),
  });
  return validateTags(JSON.parse(responseText(d)));
}
