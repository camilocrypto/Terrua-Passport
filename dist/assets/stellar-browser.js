/* The vendored Stellar SDK's stream utilities expect these Node primitives. */
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    nextTick(callback, ...args) {
      queueMicrotask(() => callback(...args));
    },
  };
}
