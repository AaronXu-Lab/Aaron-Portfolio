import { migrateClothesCategory } from "./core.mjs";

const database = new Promise((resolve, reject) => {
  const req = indexedDB.open("wardrobe-local", 2);
  req.onupgradeneeded = ({ oldVersion }) => {
    const d = req.result;
    if (oldVersion === 0) {
      const c = d.createObjectStore("clothes", { keyPath: "id" });
      c.createIndex("coarse", "coarse");
      c.createIndex("createdAt", "createdAt");
      d.createObjectStore("settings");
    } else {
      const cursor = req.transaction.objectStore("clothes").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const previous = row.value;
        const item = migrateClothesCategory(previous);
        if (item !== previous) row.update(item);
        row.continue();
      };
    }
  };
  req.onsuccess = () => {
    req.result.onversionchange = () => req.result.close();
    resolve(req.result);
  };
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error("请关闭其他衣集窗口后重试。"));
});
export async function transact(store, mode, work) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    try {
      result = work(tx.objectStore(store));
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本地保存失败。"));
  });
}
export const allClothes = () =>
  transact("clothes", "readonly", (s) => s.getAll());
export const getClothes = (id) =>
  transact("clothes", "readonly", (s) => s.get(id));
export const putClothes = (item) =>
  transact("clothes", "readwrite", (s) => s.put(item));
export const deleteClothes = (ids) =>
  transact("clothes", "readwrite", (s) => {
    ids.forEach((id) => s.delete(id));
  });
export const loadSettings = () =>
  transact("settings", "readonly", (s) => s.get("config"));
export const saveSettings = (config) =>
  transact("settings", "readwrite", (s) => s.put(config, "config"));
// Serialize modifications through IndexedDB's read/write transaction; parallel API
// completions must merge, never overwrite each other's result or manual tags.
export async function patchClothes(id, patch) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("clothes", "readwrite");
    const s = tx.objectStore("clothes");
    let result;
    const r = s.get(id);
    r.onsuccess = () => {
      if (r.result) {
        result = { ...r.result, ...patch, updatedAt: Date.now() };
        s.put(result);
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本地保存失败。"));
  });
}
