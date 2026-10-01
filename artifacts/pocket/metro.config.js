// The app sits outside the pnpm workspace with its own flat npm install: Metro's crawler
// skips pnpm's Windows junctions, so a pnpm-installed Expo app can't resolve its own
// dependencies. What it shares with the workspace is the generated API hooks, read
// straight from lib/api-client-react.
//
// Those hooks import react and @tanstack/react-query. Both must be one instance app-wide
// (hooks, QueryClient context), so they always resolve from this app's node_modules.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const API_CLIENT = path.resolve(__dirname, "../../lib/api-client-react");

config.watchFolders = [...(config.watchFolders ?? []), API_CLIENT];

// The repo is full of stray " - Copy" files, some of them OneDrive placeholders that make
// Metro's crawler fail with EINVAL on readlink. Nothing imports them.
const COPIES = / - Copy(\.[^\\/]*)?$/;
const blockList = config.resolver.blockList;
// The generated native projects (android/, ios/): a release build writes thousands of files
// there, which stalled Metro's watcher. Metro never needs them.
const escaped = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\\|\//g, "[\\\\/]");
const NATIVE = new RegExp(`^${escaped}[\\\\/](android|ios)[\\\\/]`);
config.resolver.blockList = [...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []), COPIES, NATIVE];

const SINGLETONS = ["react", "react-dom", "react-native", "@tanstack/react-query"];
const fromApp = path.join(__dirname, "package.json");

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName === "@workspace/api-client-react") {
    return { type: "sourceFile", filePath: path.join(API_CLIENT, "src", "index.ts") };
  }
  const shared = SINGLETONS.some((s) => moduleName === s || moduleName.startsWith(`${s}/`));
  return resolve(shared ? { ...context, originModulePath: fromApp } : context, moduleName, platform);
};

// Web preview only: the browser is a different origin from the API, and the API answers CORS
// preflights for better-auth's routes only to the phone app's own origin. With API_PROXY_TARGET set
// (the pocket-web launch config), /api/* goes through Metro to the API, so the page and the API
// share one origin. The phone builds never set it.
const target = process.env.API_PROXY_TARGET;
if (target) {
  const http = require("node:http");
  const url = new URL(target);
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => (req, res, next) => {
      if (!req.url.startsWith("/api/")) return middleware(req, res, next);
      const proxied = http.request({ host: url.hostname, port: url.port, path: req.url, method: req.method, headers: { ...req.headers, host: url.host } }, (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      });
      proxied.on("error", () => { res.statusCode = 502; res.end(); });
      req.pipe(proxied);
    },
  };
}

module.exports = config;
