const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const editor = $("#editor"),
  field = (name) => editor.elements.namedItem(name);
let kind = "products",
  page = 1,
  q = "",
  current = null,
  dirty = false,
  uploading = 0,
  loadSequence = 0;
const notice = (message) => {
  $("#notice").textContent = message;
};
const text = (tag, value, className) => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
};
function showLogin() {
  $("#login").hidden = false;
  $("#workspace").hidden = true;
}
async function api(path, options = {}) {
  const response = await fetch("/formyson/api/" + path, {
    ...options,
    headers: options.raw
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(data.error || "Request failed.");
  }
  return data;
}
function pending(on) {
  uploading += on ? 1 : -1;
  $$("#editor button[type=submit]").forEach(
    (b) => (b.disabled = uploading > 0),
  );
}
function discard() {
  return !dirty || confirm("Discard your unsaved changes?");
}
window.addEventListener("beforeunload", (e) => {
  if (dirty || uploading) {
    e.preventDefault();
    e.returnValue = "";
  }
});
editor.addEventListener("input", () => {
  dirty = true;
});
function button(label, action) {
  const b = text("button", label, "btn btn-ghost");
  b.type = "button";
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await action();
    } catch (e) {
      notice(e.message);
    } finally {
      b.disabled = false;
    }
  });
  return b;
}
function imageURL(url) {
  return (
    /^https:\/\//.test(url) || (/^\/(?!\/)/.test(url) && !/[\s\\]/.test(url))
  );
}
function thumbnail(url, alt) {
  const img = document.createElement("img");
  img.alt = alt || "";
  img.loading = "lazy";
  if (url && imageURL(url)) img.src = url;
  return img;
}
async function load() {
  const sequence = ++loadSequence;
  notice("Loading…");
  try {
    const data = await api(`${kind}?${new URLSearchParams({ q, page })}`);
    if (sequence !== loadSequence) return;
    if (!data.items.length && page > 1) {
      page = Math.max(1, Math.ceil(data.total / 20));
      return load();
    }
    const items = $("#items");
    items.replaceChildren();
    if (!data.items.length)
      items.append(
        text(
          "p",
          q
            ? "No results. Try a different search."
            : "No content yet. Create your first item.",
          "muted",
        ),
      );
    data.items.forEach((d) => {
      const row = document.createElement("article");
      row.className = "admin-item";
      row.append(thumbnail(d.cover?.url, d.cover?.alt));
      const info = document.createElement("div");
      info.append(
        text("h3", d.title),
        text(
          "p",
          `${d.category || "Uncategorized"} · ${d.status === "published" ? "Published" : "Draft"} · ${kind === "products" ? "Updated " + d.updatedAt.slice(0, 10) : d.publishedAt}`,
        ),
      );
      row.append(info);
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.append(
        button("Edit", () => openEditor(d.id)),
        button(d.status === "published" ? "Unpublish" : "Publish", async () => {
          await api(`${kind}/${d.id}`, {
            method: "PUT",
            body: JSON.stringify({
              ...d,
              status: d.status === "published" ? "draft" : "published",
            }),
          });
          await load();
          notice("Status updated.");
        }),
        button("Delete", async () => {
          if (
            !confirm(
              `Delete “${d.title}”? This cannot be undone. Its images will be retained.`,
            )
          )
            return;
          await api(`${kind}/${d.id}`, {
            method: "DELETE",
            body: JSON.stringify({ revision: d.revision }),
          });
          await load();
          notice("Content deleted.");
        }),
      );
      row.append(actions);
      items.append(row);
    });
    $("#page-label").textContent =
      `Page ${page} of ${Math.max(1, Math.ceil(data.total / 20))} · ${data.total} items`;
    $("#previous").disabled = page <= 1;
    $("#next").disabled = page * 20 >= data.total;
    notice("");
  } catch (e) {
    notice(e.message);
  }
}
function coverPreview() {
  const preview = $("#cover-preview"),
    url = field("coverURL").value.trim();
  preview.hidden = !imageURL(url);
  if (!preview.hidden) preview.src = url;
  else preview.removeAttribute("src");
  preview.alt = field("coverAlt").value || "Cover preview";
}
field("coverURL").addEventListener("input", coverPreview);
field("coverAlt").addEventListener("input", coverPreview);
function addGallery(img = { url: "", alt: "" }) {
  if ($$("#gallery .gallery-row").length >= 20)
    throw new Error("Use up to 20 gallery images.");
  const row = document.createElement("div");
  row.className = "gallery-row";
  const preview = thumbnail(img.url, img.alt);
  row.append(preview);
  for (const [key, label] of [
    ["url", "Image URL"],
    ["alt", "Alt text"],
  ]) {
    const wrapper = text("label", label),
      input = document.createElement("input");
    input.value = img[key];
    input.dataset.imageField = key;
    input.maxLength = key === "url" ? 2000 : 300;
    input.required = key === "url";
    input.addEventListener("input", () => {
      if (key === "url") {
        if (imageURL(input.value)) preview.src = input.value;
        else preview.removeAttribute("src");
      } else preview.alt = input.value;
    });
    wrapper.append(input);
    row.append(wrapper);
  }
  const controls = document.createElement("div");
  controls.className = "admin-actions";
  controls.append(
    button("↑", () => {
      if (row.previousElementSibling) row.before(row.previousElementSibling);
      dirty = true;
    }),
    button("↓", () => {
      if (row.nextElementSibling) row.after(row.nextElementSibling);
      dirty = true;
    }),
    button("Remove", () => {
      row.remove();
      dirty = true;
    }),
  );
  controls.children[0].setAttribute("aria-label", "Move image up");
  controls.children[1].setAttribute("aria-label", "Move image down");
  row.append(controls);
  $("#gallery").append(row);
}
async function openEditor(id) {
  if (!discard()) return;
  notice("");
  current = id
    ? await api(`${kind}/${id}`)
    : {
        status: "draft",
        publishedAt: new Date().toISOString().slice(0, 10),
        gallery: [],
        specs: [],
        tags: [],
      };
  editor.reset();
  field("slug").required = kind === "products";
  field("publishedAt").required = kind === "products";
  field("body").required = kind === "articles";
  $("#optional-settings").open = kind === "products";
  for (const name of [
    "title",
    "slug",
    "category",
    "status",
    "publishedAt",
    "author",
    "summary",
    "body",
    "seoTitle",
    "seoDescription",
  ])
    field(name).value = current[name] || "";
  field("coverURL").value = current.cover?.url || "";
  field("coverAlt").value = current.cover?.alt || "";
  field("specs").value = current.specs
    .map((pair) => pair.join(" | "))
    .join("\n");
  field("tags").value = current.tags.join(", ");
  $("#gallery").replaceChildren();
  current.gallery.forEach(addGallery);
  coverPreview();
  $$("[data-product]").forEach((e) => (e.hidden = kind !== "products"));
  $$("[data-article]").forEach((e) => (e.hidden = kind !== "articles"));
  const options =
    kind === "products"
      ? ["T-Shirts", "Hoodies", "Denim", "Outerwear", "Knitwear", "Activewear"]
      : ["Industry News", "Craftsmanship", "Case Studies"];
  $("#category-options").replaceChildren(
    ...options.map((v) => {
      const option = document.createElement("option");
      option.value = v;
      return option;
    }),
  );
  $("#editor-heading").textContent =
    `${id ? "Edit" : "New"} ${kind === "products" ? "product" : "article"}`;
  $("#list-view").hidden = true;
  editor.hidden = false;
  $("#body-preview").hidden = true;
  const link = $("#view-item");
  link.hidden = current.status !== "published";
  if (!link.hidden) link.href = `/formyson/${kind}/${current.slug}/`;
  dirty = false;
  field("title").focus();
}
field("title").addEventListener("input", () => {
  if (kind === "products" && !current?.id && !field("slug").dataset.manual)
    field("slug").value = field("title")
      .value.toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120)
      .replace(/-$/, "");
});
field("slug").addEventListener("input", () => {
  field("slug").dataset.manual = "true";
});
async function compress(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP image up to 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 50000000)
      throw new Error(
        "This image is too large. Use an image below 50 megapixels.",
      );
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.size > 5 * 1024 * 1024)
      throw new Error(
        "The optimized image exceeds 5 MB. Choose a smaller image.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
async function upload(file) {
  pending(true);
  notice(`Uploading ${file.name}…`);
  try {
    const blob = await compress(file);
    const d = await api("upload", {
      method: "POST",
      raw: true,
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    notice("Image uploaded. Save your changes to attach it.");
    dirty = true;
    return d.url;
  } finally {
    pending(false);
  }
}
$("#cover-file").addEventListener("change", async (e) => {
  try {
    if (!e.target.files[0]) return;
    field("coverURL").value = await upload(e.target.files[0]);
    coverPreview();
  } catch (err) {
    notice(err.message);
  } finally {
    e.target.value = "";
  }
});
$("#gallery-files").addEventListener("change", async (e) => {
  try {
    const files = [...e.target.files];
    if (files.length + $$("#gallery .gallery-row").length > 20)
      throw new Error("Use up to 20 gallery images.");
    for (const file of files) addGallery({ url: await upload(file), alt: "" });
  } catch (err) {
    notice(err.message);
  } finally {
    e.target.value = "";
  }
});
$("#add-image").addEventListener("click", () => {
  try {
    addGallery();
    dirty = true;
  } catch (e) {
    notice(e.message);
  }
});
function insert(value) {
  const area = field("body");
  area.setRangeText(value, area.selectionStart, area.selectionEnd, "end");
  area.focus();
  dirty = true;
}
$("#insert-link").addEventListener("click", () => {
  const label = prompt(
    "Link text",
    field("body").value.slice(
      field("body").selectionStart,
      field("body").selectionEnd,
    ),
  );
  if (label === null) return;
  const url = prompt("Link URL", "https://");
  if (url) insert(`[${label.replace(/[\[\]]/g, "")}](${url})`);
});
$("#body-file").addEventListener("change", async (e) => {
  try {
    if (!e.target.files[0]) return;
    const alt = prompt("Describe this image (alt text):");
    if (alt === null) return;
    const url = await upload(e.target.files[0]);
    insert(`\n\n![${alt.replace(/[\[\]]/g, "")}](${url})\n\n`);
  } catch (err) {
    notice(err.message);
  } finally {
    e.target.value = "";
  }
});
$("#preview-button").addEventListener("click", async () => {
  try {
    const data = await api("preview", {
      method: "POST",
      body: JSON.stringify({ body: field("body").value }),
    });
    $("#body-preview").innerHTML = data.html;
    $("#body-preview").hidden = false;
    notice("Body preview updated. Changes are not saved yet.");
  } catch (e) {
    notice(e.message);
  }
});
editor.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (uploading) return;
  const data = Object.fromEntries(new FormData(editor));
  data.cover = data.coverURL.trim()
    ? { url: data.coverURL.trim(), alt: data.coverAlt.trim() }
    : null;
  data.gallery = $$("#gallery .gallery-row").map((row) =>
    Object.fromEntries(
      [...row.querySelectorAll("input")].map((i) => [
        i.dataset.imageField,
        i.value.trim(),
      ]),
    ),
  );
  const lines = data.specs.split("\n").filter((s) => s.trim());
  if (lines.some((s) => !s.includes("|"))) {
    notice("Each specification needs a label and value separated by |.");
    return;
  }
  data.specs = lines.map((s) => {
    const at = s.indexOf("|");
    return [s.slice(0, at).trim(), s.slice(at + 1).trim()];
  });
  data.tags = data.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  data.revision = current.revision;
  pending(true);
  for (const element of editor.elements) element.disabled = true;
  editor.setAttribute("aria-busy", "true");
  try {
    current = await api(kind + (current.id ? "/" + current.id : ""), {
      method: current.id ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    for (const name of ["slug", "publishedAt", "category", "author", "summary"])
      field(name).value = current[name] || "";
    field("coverURL").value = current.cover?.url || "";
    field("coverAlt").value = current.cover?.alt || "";
    coverPreview();
    dirty = false;
    const link = $("#view-item");
    link.hidden = current.status !== "published";
    link.href = `/formyson/${kind}/${current.slug}/`;
    $("#editor-heading").textContent =
      `Edit ${kind === "products" ? "product" : "article"}`;
    notice(
      current.status === "published"
        ? "Saved and published. The website is up to date."
        : "Draft saved. This content is hidden from the website.",
    );
  } catch (err) {
    notice(err.message);
  } finally {
    for (const element of editor.elements) element.disabled = false;
    editor.removeAttribute("aria-busy");
    pending(false);
  }
});
$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.target.querySelector("button");
  b.disabled = true;
  try {
    await api("login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    e.target.reset();
    e.target.hidden = true;
    $("#workspace").hidden = false;
    if (editor.hidden) await load();
    else notice("Signed in. You can save your changes now.");
  } catch (err) {
    notice(err.message);
  } finally {
    b.disabled = false;
  }
});
$("#logout").addEventListener("click", async () => {
  if (!discard() || uploading) return;
  try {
    await api("logout", { method: "POST", body: "{}" });
    dirty = false;
    editor.hidden = true;
    $("#list-view").hidden = false;
    showLogin();
    notice("Signed out.");
  } catch (e) {
    notice(e.message);
  }
});
$$("[data-kind]").forEach((b) =>
  b.addEventListener("click", async () => {
    if (uploading || !discard()) return;
    dirty = false;
    kind = b.dataset.kind;
    page = 1;
    q = "";
    $("#search").value = "";
    editor.hidden = true;
    $("#list-view").hidden = false;
    $$("[data-kind]").forEach((t) =>
      t.setAttribute("aria-pressed", String(t === b)),
    );
    $("#create").textContent =
      kind === "products" ? "New product" : "New article";
    await load();
  }),
);
$("#create").addEventListener("click", () => {
  delete field("slug").dataset.manual;
  openEditor().catch((e) => notice(e.message));
});
$("#cancel").addEventListener("click", () => {
  if (uploading || !discard()) return;
  dirty = false;
  editor.hidden = true;
  $("#list-view").hidden = false;
  load();
});
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  q = $("#search").value.trim();
  page = 1;
  load();
});
$("#previous").addEventListener("click", () => {
  page--;
  load();
});
$("#next").addEventListener("click", () => {
  page++;
  load();
});
try {
  await api("session");
  $("#workspace").hidden = false;
  await load();
} catch (e) {
  showLogin();
  notice(e.message === "Please sign in." ? "" : e.message);
}

editor.addEventListener("invalid", (event) => {
  if (event.target.closest("#optional-settings")) $("#optional-settings").open = true;
}, true);
