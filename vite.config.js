import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import openaiResponseHandler from "./api/openai-response.js";
import fetchPdfHandler from "./api/fetch-pdf.js";

function createDevApiPlugin() {
  const sendResponse = async (nodeResponse, webResponse) => {
    nodeResponse.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
      nodeResponse.setHeader(key, value);
    });
    const body = Buffer.from(await webResponse.arrayBuffer());
    nodeResponse.end(body);
  };

  const readRequestBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

  const toWebRequest = async (req) => {
    const origin = `http://${req.headers.host || "localhost:5173"}`;
    const url = new URL(req.url || "/", origin);
    const headers = new Headers();
    Object.entries(req.headers || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => headers.append(key, entry));
      } else if (value != null) {
        headers.set(key, String(value));
      }
    });

    const init = {
      method: req.method || "GET",
      headers,
    };

    if (!["GET", "HEAD"].includes(init.method.toUpperCase())) {
      const body = await readRequestBody(req);
      init.body = body;
      init.duplex = "half";
    }

    return new Request(url, init);
  };

  const handle = (matcher, handler) => async (req, res, next) => {
    if (!matcher(req.url || "")) {
      next();
      return;
    }

    try {
      const webRequest = await toWebRequest(req);
      const webResponse = await handler.fetch(webRequest);
      await sendResponse(res, webResponse);
    } catch (error) {
      console.error("dev api middleware failed", error);
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: error?.message || "Local API handler failed." }));
    }
  };

  return {
    name: "paperview-dev-api",
    configureServer(server) {
      server.middlewares.use(handle((url) => url.startsWith("/api/openai-response"), openaiResponseHandler));
      server.middlewares.use(handle((url) => url.startsWith("/api/fetch-pdf"), fetchPdfHandler));
    },
  };
}

async function fetchRepoSnapshot() {
  const repo = "Carstenhanekamp/paperview";
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!res.ok) throw new Error(`gh ${res.status}`);
    const json = await res.json();
    return {
      stars: typeof json.stargazers_count === "number" ? json.stargazers_count : null,
      forks: typeof json.forks_count === "number" ? json.forks_count : null,
      language: json.language || null,
      license: json.license?.spdx_id || null,
      updatedAt: json.pushed_at || json.updated_at || null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[vite] GitHub repo snapshot failed:", err?.message || err);
    return null;
  }
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  const repoSnapshot = await fetchRepoSnapshot();

  return {
    define: {
      __GH_REPO_SNAPSHOT__: JSON.stringify(repoSnapshot),
    },
    plugins: [
      react(),
      createDevApiPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", "apple-touch-icon.png"],
        manifest: {
          name: "Paperview",
          short_name: "Paperview",
          description: "AI-powered research paper reader with source-backed answers",
          theme_color: "#f6f5f1",
          background_color: "#f6f5f1",
          display: "standalone",
          start_url: "/",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "cdn-cache",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  };
});
