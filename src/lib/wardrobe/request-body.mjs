import { CATEGORIES } from "./core.mjs";

export function imageRequestBody(original, config) {
  const form = new FormData();
  form.append("image", original, "garment.jpg");
  form.append("model", config.imageModel);
  form.append("prompt", config.imagePrompt);
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("size", "1024x1024");
  form.append("quality", config.imageModel === "gpt-image-2.6-flare" ? "medium" : "high");
  return form;
}

export function tagRequestBody(image, config) {
  return {
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
  };
}
