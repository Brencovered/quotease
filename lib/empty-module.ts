// Intentionally empty. Turbopack's resolveAlias (see next.config.ts) points
// fs/net/tls to this file for browser bundles, standing in for webpack's old
// `resolve.fallback: { fs: false, ... }` behavior -- if client code doesn't
// actually use these, importing this empty module is a harmless no-op.
export {};
