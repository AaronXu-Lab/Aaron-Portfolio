import test from "node:test";
import assert from "node:assert/strict";
import { keepScreenAwake } from "../src/lib/wardrobe/screen-wake-lock.mjs";
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture(request) {
  const document = new EventTarget();
  document.visibilityState = "visible";
  const locks = [];
  let requests = 0;
  const navigator = {
    wakeLock: {
      request: async (type) => {
        assert.equal(type, "screen");
        requests++;
        if (request) return request();
        const lock = new EventTarget();
        lock.released = false;
        lock.release = async () => {
          lock.released = true;
          lock.dispatchEvent(new Event("release"));
        };
        locks.push(lock);
        return lock;
      },
    },
  };
  const visibility = (value) => {
    document.visibilityState = value;
    document.dispatchEvent(new Event("visibilitychange"));
  };
  return { navigator, document, locks, visibility, requests: () => requests };
}
test("processing holds one lock and cleanup releases it without changing preferences", async () => {
  const f = fixture(),
    stop = keepScreenAwake(f.navigator, f.document);
  await flush();
  assert.equal(f.requests(), 1);
  f.visibility("visible");
  await flush();
  assert.equal(f.requests(), 1);
  assert.equal(f.locks[0].released, false);
  stop();
  assert.equal(f.locks[0].released, true);
  f.visibility("visible");
  await flush();
  assert.equal(f.requests(), 1);
});
test("hidden pages release; visible processing reacquires including system releases", async () => {
  const f = fixture(),
    stop = keepScreenAwake(f.navigator, f.document);
  await flush();
  f.visibility("hidden");
  assert.equal(f.locks[0].released, true);
  f.visibility("visible");
  await flush();
  assert.equal(f.requests(), 2);
  await f.locks[1].release();
  f.visibility("visible");
  await flush();
  assert.equal(f.requests(), 3);
  stop();
  assert.equal(f.locks[2].released, true);
});
test("completion while permission is pending releases the late lock", async () => {
  let resolve;
  const f = fixture(() => new Promise((r) => (resolve = r)));
  const stop = keepScreenAwake(f.navigator, f.document);
  stop();
  let released = false;
  resolve({
    released: false,
    release: async () => {
      released = true;
    },
  });
  await flush();
  assert.equal(released, true);
});
test("unsupported and denied wake locks do not break processing or spin retries", async () => {
  const f = fixture(() => Promise.reject(new Error("NotAllowedError")));
  assert.doesNotThrow(() => keepScreenAwake({}, f.document)());
  const stop = keepScreenAwake(f.navigator, f.document);
  await flush();
  assert.equal(f.requests(), 1);
  stop();
  f.visibility("visible");
  await flush();
  assert.equal(f.requests(), 1);
});
