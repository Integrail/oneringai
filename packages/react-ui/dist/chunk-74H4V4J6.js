// src/markdown/importOptional.ts
async function importOptional(specifier) {
  return new Function("s", "return import(s)")(specifier);
}

export {
  importOptional
};
//# sourceMappingURL=chunk-74H4V4J6.js.map