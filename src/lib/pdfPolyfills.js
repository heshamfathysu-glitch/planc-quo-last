// Small fills for browser features pdf.js expects but older Safari (iPhone)
// lacks. Loaded on the page and inside the pdf.js worker.
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new this((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };
}
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}
