import { IMAGE_PROMPT, PREVIOUS_IMAGE_PROMPT } from "./prompts.mjs";
const PREVIOUS_2048_IMAGE_PROMPT = PREVIOUS_IMAGE_PROMPT.replace("1024 × 1024", "2048 × 2048");
const LEGACY_IMAGE_PROMPT =
  "将照片中的单件衣服或配饰制作成干净的商品素材图。移除衣架、夹子、背景及其他物体，保留完整轮廓。严格保留原始颜色、材质、纹理、图案、标志、剪裁和比例，不改款、不美化、不添加装饰。自然展平，居中，四周留少量透明空间，不添加投影。输出真正带 alpha 通道的透明背景 PNG。";
const SUBCATEGORIES = new Map([
  ["上衣", ["T 恤", "衬衫", "针织衫"]],
  ["裤子", ["长裤", "短裤"]],
  ["外套", ["薄外套", "厚外套", "卫衣", "马甲"]],
]);
const STANDALONE_CATEGORIES = ["裙子", "鞋子", "包袋", "配饰", "其他"];
export const MAIN_CATEGORIES = [...SUBCATEGORIES.keys(), ...STANDALONE_CATEGORIES];
export const CATEGORIES = [...SUBCATEGORIES.values()].flat().concat("外套", STANDALONE_CATEGORIES);
export const subcategoriesFor = (main) => SUBCATEGORIES.get(main) ?? [];
export function mainCategoryFor(category) {
  return [...SUBCATEGORIES].find(([, children]) => children.includes(category))?.[0]
    ?? (MAIN_CATEGORIES.includes(category) ? category : "其他");
}
export function matchesCategory(item, main, sub = "") {
  return (!main || mainCategoryFor(item.coarse) === main) && (!sub || item.coarse === sub);
}
const PREVIOUS_TAG_PROMPT =
  '识别原图中的主要衣服或配饰，忽略衣架和背景。coarse 必须从上衣、裤子、裙子、外套、鞋子、包袋、配饰、其他中选一个。fine 使用简短中文标签，包含可见的款式、颜色、版型、袖长、材质和图案；不确定的属性不要猜测。只返回符合指定结构的 JSON：{"coarse":"上衣","fine":["T恤","黑色","宽松","短袖"]}。';
export const CATEGORY_RULES =
  `分类必须从${CATEGORIES.join("、")}中选一个。长袖 T 恤和 Polo 衫归 T 恤，Polo 款保留「Polo」标签。毛衣和针织开衫归针织衫。裤脚在膝盖附近及以上归短裤，明显过膝归长裤。套头和拉链卫衣都归卫衣；无袖外穿款归马甲。其余外套有填充、加绒或明显厚重的面料时归厚外套，明显轻薄的归薄外套。能确认是外套但看不出厚薄时，归「外套」，不猜测内里或材质。 外套主类下的衣物必须在 fine 中标注袖长：有袖时填「长袖」或「短袖」，无袖时填「无袖」（例如马甲）。袖长标签只填一个；衣身短款不等于短袖。`;
export const DEFAULT_MODE_MODELS = {
  image: ["gpt-image-2.6-flare", "gpt-image-2.6-sunburst"],
  tags: ["gpt-6.1-terra", "gpt-6-luna"],
};
export const DEFAULTS = {
  apiMode: "default",
  apiKey: "",
  generateTransparent: true,
  trackProcessing: false,
  recognitionDefaultVersion: 1,
  imageDefaultVersion: 1,
  imageModel: "gpt-image-2.5-sunburst",
  tagModel: DEFAULT_MODE_MODELS.tags[0],
  defaultImageModel: DEFAULT_MODE_MODELS.image[0],
  defaultTagModel: DEFAULT_MODE_MODELS.tags[0],
  imagePrompt: IMAGE_PROMPT,
  tagPrompt:
    "识别原图中的主要衣服或配饰，忽略衣架和背景。fine 使用简短中文标签，描述可见的款式、颜色、版型、袖长、材质和图案；不确定的属性不要猜测。",
};
export function defaultModeModel(type, value) {
  const options = DEFAULT_MODE_MODELS[type];
  if (type === "image" && typeof value === "string") {
    value = value.replace(/^gpt-image-2\.5-(sunburst|flare)$/, "gpt-image-2.6-$1");
  }
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
      [item.coarse, mainCategoryFor(item.coarse), ...item.fine]
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
  const mainCategory = mainCategoryFor(item.coarse);
  return {
    id: item.id,
    coarse: item.coarse,
    mainCategory,
    subCategory: subcategoriesFor(mainCategory).includes(item.coarse) ? item.coarse : null,
    fine: item.fine,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
export function exportName(item) {
  return `${CATEGORIES.includes(item.coarse) ? item.coarse : "其他"}-${item.id}`;
}
export function migrateClothesCategory(item) {
  if (!["上衣", "裤子", "外套"].includes(item.coarse)) return item;
  const fine = Array.isArray(item.fine) ? item.fine : [];
  const tags = fine.join(" ");
  let coarse = "其他";
  if (item.coarse === "裤子") {
    if (/短裤|五分裤|及膝裤/.test(tags)) coarse = "短裤";
    else if (/长裤|七分裤|九分裤/.test(tags)) coarse = "长裤";
  } else if (/马甲/.test(tags)) coarse = "马甲";
  else if (/卫衣/.test(tags)) coarse = "卫衣";
  else if (item.coarse === "上衣") {
    if (/T\s*恤|Polo/i.test(tags)) coarse = "T 恤";
    else if (/毛衣|针织/.test(tags)) coarse = "针织衫";
    else if (/衬衫/.test(tags)) coarse = "衬衫";
  } else if (/厚外套|羽绒|棉服|加绒|绒里|毛呢|填充/.test(tags)) {
    coarse = "厚外套";
  } else if (/薄外套|轻薄|薄款/.test(tags)) {
    coarse = "薄外套";
  } else {
    return item;
  }
  return { ...item, coarse };
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
  // Previous settings stored Sunburst even when the user had never chosen a model.
  if (value?.imageDefaultVersion !== DEFAULTS.imageDefaultVersion) {
    result.defaultImageModel = DEFAULTS.defaultImageModel;
    result.imageDefaultVersion = DEFAULTS.imageDefaultVersion;
  }
  result.defaultTagModel = defaultModeModel("tags", result.defaultTagModel);
  if (result.tagPrompt === PREVIOUS_TAG_PROMPT) result.tagPrompt = DEFAULTS.tagPrompt;
  if ([LEGACY_IMAGE_PROMPT, PREVIOUS_2048_IMAGE_PROMPT, PREVIOUS_IMAGE_PROMPT].includes(result.imagePrompt))
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
