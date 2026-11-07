import { IMAGE_PROMPT } from "./prompts.mjs";
const LEGACY_IMAGE_PROMPT =
  "将照片中的单件衣服或配饰制作成干净的商品素材图。移除衣架、夹子、背景及其他物体，保留完整轮廓。严格保留原始颜色、材质、纹理、图案、标志、剪裁和比例，不改款、不美化、不添加装饰。自然展平，居中，四周留少量透明空间，不添加投影。输出真正带 alpha 通道的透明背景 PNG。";
export const CATEGORIES = [
  "上衣",
  "裤子",
  "裙子",
  "外套",
  "鞋子",
  "包袋",
  "配饰",
  "其他",
];
export const DEFAULT_MODE_MODELS = {
  image: ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"],
  tags: ["gpt-6.1-terra", "gpt-6-luna"],
};
export const DEFAULTS = {
  apiMode: "default",
  apiKey: "",
  generateTransparent: true,
  recognitionDefaultVersion: 1,
  imageModel: DEFAULT_MODE_MODELS.image[0],
  tagModel: DEFAULT_MODE_MODELS.tags[0],
  defaultImageModel: DEFAULT_MODE_MODELS.image[0],
  defaultTagModel: DEFAULT_MODE_MODELS.tags[0],
  imagePrompt: IMAGE_PROMPT,
  tagPrompt:
    '识别原图中的主要衣服或配饰，忽略衣架和背景。coarse 必须从上衣、裤子、裙子、外套、鞋子、包袋、配饰、其他中选一个。fine 使用简短中文标签，包含可见的款式、颜色、版型、袖长、材质和图案；不确定的属性不要猜测。只返回符合指定结构的 JSON：{"coarse":"上衣","fine":["T恤","黑色","宽松","短袖"]}。',
};
export function defaultModeModel(type, value) {
  const options = DEFAULT_MODE_MODELS[type];
  return options.includes(value) ? value : options[0];
}
export function personalApiKey(settings) {
  return settings.apiMode === "byok" ? settings.apiKey.trim() : "";
}
export function canUseApi(settings) {
  return settings.apiMode === "default" || Boolean(personalApiKey(settings));
}
export function validateTags(value) {
  if (
    !value ||
    !CATEGORIES.includes(value.coarse) ||
    !Array.isArray(value.fine) ||
    value.fine.some((t) => typeof t !== "string")
  )
    throw new Error("标签格式不正确，请重新识别。");
  return {
    coarse: value.coarse,
    fine: [...new Set(value.fine.map((t) => t.trim()).filter(Boolean))].slice(
      0,
      30,
    ),
  };
}
export function matches(item, coarse, tags, query = "") {
  return (
    (!coarse || item.coarse === coarse) &&
    tags.every((t) => item.fine.includes(t)) &&
    (!query ||
      [item.coarse, ...item.fine]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()))
  );
}
export function missingSteps(item) {
  return [
    !item.transparentBlob && !item.imageSkipped && "image",
    !item.tagsDone && "tags",
  ].filter(Boolean);
}
export function exportMetadata(item) {
  return {
    id: item.id,
    coarse: item.coarse,
    fine: item.fine,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
export function exportName(item) {
  return `${CATEGORIES.includes(item.coarse) ? item.coarse : "其他"}-${item.id}`;
}
export function cleanSettings(value) {
  const result = {};
  for (const k of Object.keys(DEFAULTS))
    result[k] =
      typeof value?.[k] === typeof DEFAULTS[k] ? value[k] : DEFAULTS[k];
  // Older settings have a personal Key but no mode.
  if (value?.apiMode !== "default" && value?.apiMode !== "byok")
    result.apiMode = result.apiKey.trim() ? "byok" : "default";
  result.defaultImageModel = defaultModeModel("image", result.defaultImageModel);
  result.defaultTagModel = defaultModeModel("tags", result.defaultTagModel);
  if (result.imagePrompt === LEGACY_IMAGE_PROMPT)
    result.imagePrompt = IMAGE_PROMPT;
  if (
    value?.recognitionDefaultVersion !== 1 &&
    result.tagModel === "gpt-6-astra"
  )
    result.tagModel = DEFAULTS.tagModel;
  return result;
}
export function responseText(data) {
  if (data.status === "incomplete") throw new Error("标签返回不完整，请重试。");
  const text = data.output
    ?.flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
  if (!text) throw new Error("模型未返回标签，可能拒绝了此图片。");
  return text;
}
