if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, "toReversed", {
    value() {
      return [...this].reverse();
    },
    writable: true,
    configurable: true,
  });
}

const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  ...config.resolver.blockList,
  /[/\\]\.local[/\\]state[/\\]workflow-logs[/\\]/,
];

// Keep browser API requests same-origin in the proxied Expo web preview.
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const app = enhanceMiddleware
    ? enhanceMiddleware(middleware, metroServer)
    : middleware;
  const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:${process.env.PORT || process.env.SERVER_PORT || "5050"}`,
    pathFilter: (pathname) => pathname === "/api" || pathname.startsWith("/api/"),
    changeOrigin: true,
  });
  return (req, res, next) => proxy(req, res, () => app(req, res, next));
};

module.exports = config;
