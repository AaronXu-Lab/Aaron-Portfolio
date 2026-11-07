import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTags,
  matches,
  missingSteps,
  exportMetadata,
  exportName,
  cleanSettings,
  personalApiKey,
  canUseApi,
  DEFAULTS,
  responseText,
} from "../src/lib/wardrobe/core.mjs";
test("strict tag contract, whitespace and duplicates", () => {
  assert.deepEqual(
    validateTags({ coarse: "上衣", fine: [" 黑色 ", "黑色", ""] }),
    { coarse: "上衣", fine: ["黑色"] },
  );
  assert.throws(() => validateTags({ coarse: "未知", fine: [] }));
  assert.throws(() => validateTags({ coarse: "上衣", fine: [3] }));
});
test("category AND all selected fine tags with text search", () => {
  const i = { coarse: "上衣", fine: ["黑色", "短袖"] };
  assert.ok(matches(i, "上衣", ["短袖", "黑色"], "黑"));
  assert.equal(matches(i, "裤子", []), false);
  assert.equal(matches(i, "", ["宽松"]), false);
});
test("retry only missing results, successful image never charged twice", () => {
  assert.deepEqual(
    missingSteps({ transparentBlob: new Blob(), tagsDone: false }),
    ["tags"],
  );
  assert.deepEqual(missingSteps({ tagsDone: true }), ["image"]);
  assert.deepEqual(
    missingSteps({ transparentBlob: new Blob(), tagsDone: true }),
    [],
  );
});
test("exports never contain original, credentials, or internal errors", () => {
  const i = {
    id: "abc",
    coarse: "上衣",
    fine: ["黑色"],
    createdAt: 1,
    updatedAt: 2,
    originalBlob: new Blob(),
    preparedBlob: new Blob(),
    transparentBlob: new Blob(),
    apiKey: "secret",
    imageError: "x",
  };
  assert.deepEqual(Object.keys(exportMetadata(i)), [
    "id",
    "coarse",
    "fine",
    "createdAt",
    "updatedAt",
  ]);
  assert.equal(exportName(i), "上衣-abc");
  assert.equal(exportName({ ...i, coarse: "../../bad" }), "其他-abc");
});
test("settings default migration preserves edited prompts and key removal", () => {
  assert.deepEqual(cleanSettings(null), DEFAULTS);
  const upgraded = cleanSettings({
    defaultImageModel: "gpt-image-2.5-flare",
    imageModel: "gpt-image-2.5-flare",
  });
  assert.equal(upgraded.defaultImageModel, "gpt-image-2.6-flare");
  assert.equal(upgraded.imageModel, "gpt-image-2.5-flare");
  assert.equal(
    cleanSettings({ apiKey: "", imagePrompt: "mine" }).imagePrompt,
    "mine",
  );
  assert.equal(cleanSettings({ apiKey: "" }).apiKey, "");
});
test("old personal Keys migrate to BYOK and stay saved when using Default", () => {
  assert.equal(cleanSettings(null).apiMode, "default");
  const migrated = cleanSettings({ apiKey: "  personal-key  " });
  assert.equal(migrated.apiMode, "byok");
  assert.equal(personalApiKey(migrated), "personal-key");

  const switched = cleanSettings({ ...migrated, apiMode: "default" });
  assert.equal(personalApiKey(switched), "");
  assert.equal(canUseApi(switched), true);
  assert.equal(
    personalApiKey(cleanSettings({ ...switched, apiMode: "byok" })),
    "personal-key",
  );
  assert.equal(canUseApi(cleanSettings({ apiMode: "byok" })), false);
});
test("structured responses refuse missing and incomplete output", () => {
  assert.equal(
    responseText({
      output: [{ content: [{ type: "output_text", text: "{}" }] }],
    }),
    "{}",
  );
  assert.throws(() => responseText({ status: "incomplete", output: [] }));
  assert.throws(() =>
    responseText({
      output: [{ content: [{ type: "refusal", refusal: "no" }] }],
    }),
  );
});

test("new default replaces only the previous stock prompt, never a custom prompt", () => {
  const previous =
    "将照片中的单件衣服或配饰制作成干净的商品素材图。移除衣架、夹子、背景及其他物体，保留完整轮廓。严格保留原始颜色、材质、纹理、图案、标志、剪裁和比例，不改款、不美化、不添加装饰。自然展平，居中，四周留少量透明空间，不添加投影。输出真正带 alpha 通道的透明背景 PNG。";
  // Arbitrary existing edits are preserved; the complete supplied default is used for fresh settings.
  assert.equal(
    cleanSettings({ imagePrompt: previous }).imagePrompt,
    DEFAULTS.imagePrompt,
  );
  assert.equal(
    cleanSettings({ imagePrompt: "my custom prompt" }).imagePrompt,
    "my custom prompt",
  );
  assert.match(DEFAULTS.imagePrompt, /1024 × 1024/);
  const oldStock = DEFAULTS.imagePrompt.replace("1024 × 1024", "2048 × 2048");
  assert.equal(cleanSettings({ imagePrompt: oldStock }).imagePrompt, DEFAULTS.imagePrompt);
  assert.equal(cleanSettings({ imagePrompt: oldStock + "\n自定义要求。" }).imagePrompt, oldStock + "\n自定义要求。");
  assert.match(DEFAULTS.imagePrompt, /商品真实性 ＞ 结构完整性/);
});

test("Terra is the recognition default and replaces the previous stock model", () => {
  assert.equal(DEFAULTS.tagModel, "gpt-6.1-terra");
  assert.equal(
    cleanSettings({ tagModel: "gpt-6-astra" }).tagModel,
    "gpt-6.1-terra",
  );
  assert.equal(
    cleanSettings({ tagModel: "gpt-6-luna" }).tagModel,
    "gpt-6-luna",
  );
  assert.equal(
    cleanSettings({ tagModel: "gpt-6-astra", recognitionDefaultVersion: 1 })
      .tagModel,
    "gpt-6-astra",
  );
});

test("tag-only records do not schedule image generation or remain incomplete", () => {
  assert.equal(cleanSettings(null).generateTransparent, true);
  assert.equal(
    cleanSettings({ generateTransparent: false }).generateTransparent,
    false,
  );
  assert.deepEqual(missingSteps({ imageSkipped: true, tagsDone: false }), [
    "tags",
  ]);
  assert.deepEqual(missingSteps({ imageSkipped: true, tagsDone: true }), []);
  assert.deepEqual(missingSteps({ tagsDone: true }), ["image"]);
});
