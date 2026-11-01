// One lifetime per processing batch; released requests must not outlive the task.
export function keepScreenAwake(navigator, document) {
  if (!navigator.wakeLock?.request) return () => {};
  let stopped = false;
  let pending = false;
  let lock = null;
  const release = (sentinel) => {
    if (sentinel && !sentinel.released) {
      try {
        Promise.resolve(sentinel.release()).catch(() => {});
      } catch {
        // A failed release must not interrupt processing or cleanup.
      }
    }
  };
  const acquire = async () => {
    if (
      stopped ||
      pending ||
      document.visibilityState !== "visible" ||
      (lock && !lock.released)
    )
      return;
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request("screen");
      if (stopped || document.visibilityState !== "visible") {
        release(acquired);
        return;
      }
      lock = acquired;
      acquired.addEventListener(
        "release",
        () => {
          if (lock === acquired) lock = null;
        },
        { once: true },
      );
    } catch {
      // Unsupported policy, low battery or OS denial: processing still works.
    } finally {
      pending = false;
    }
  };
  const visibilityChanged = () => {
    if (document.visibilityState === "visible") void acquire();
    else {
      const previous = lock;
      lock = null;
      release(previous);
    }
  };
  document.addEventListener("visibilitychange", visibilityChanged);
  void acquire();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", visibilityChanged);
    release(lock);
    lock = null;
  };
}
