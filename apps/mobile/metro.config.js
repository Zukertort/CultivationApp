// Metro config: Expo defaults plus two things this repo needs.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads SQLite as WebAssembly, which needs cross-origin
// isolation (SharedArrayBuffer) in the dev server.
config.resolver.assetExts.push("wasm");
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  middleware(req, res, next);
};

// The workspace packages (@cultivation/rules, @cultivation/schema) ship
// TypeScript source with ESM-style "./config.js" imports. If a relative ".js"
// import doesn't resolve, retry without the extension so Metro finds the ".ts".
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
