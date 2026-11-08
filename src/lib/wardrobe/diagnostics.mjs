const STORAGE_KEY = "wardrobe-processing-log-v1";
const LIMIT = 200;

export function readProcessingLog() {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(entries) ? entries.slice(-LIMIT) : [];
  } catch {
    return [];
  }
}

export function appendProcessingLog(entry) {
  try {
    const entries = readProcessingLog();
    entries.push({
      time: new Date().toISOString(),
      online: navigator.onLine,
      visibility: document.visibilityState,
      ...entry,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-LIMIT)));
  } catch {
    // Diagnostics must never interrupt photo processing.
  }
}
