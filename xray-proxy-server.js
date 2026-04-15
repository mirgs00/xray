/**
 * XRAY TEST DASHBOARD PROXY SERVER
 *
 * - Solves CORS issues by proxying requests to Jira/Xray APIs
 * - Uses Jira REST API v3 (search/jql – non-deprecated)
 * - Supports Xray Cloud authentication and GraphQL
 *
 * Port: 3001
 */

"use strict";

const http = require("http");
const https = require("https");
const url = require("url");
const os = require("os");

const PORT = 3001;

// ----------------------------------------------------------------------------
// Environment info
// ----------------------------------------------------------------------------
const SERVER_ENV = {
  platform: process.platform,
  nodeVersion: process.version,
  hostname: os.hostname(),
  startTime: new Date().toISOString(),
  pid: process.pid,
};

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

function clean(value = "") {
  return typeof value === "string" ? value.replace(/&amp;/g, "&") : value;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function proxyRequest(targetUrl, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const transport = target.protocol === "https:" ? https : http;

    const req = transport.request(
      target,
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers,
          })
        );
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildAuthHeader(auth) {
  if (auth.mode === "basic") {
    const encoded = Buffer.from(`${auth.email}:${auth.token}`).toString(
      "base64"
    );
    return { Authorization: `Basic ${encoded}` };
  }

  if (auth.mode === "bearer") {
    return { Authorization: `Bearer ${auth.bearerToken}` };
  }

  return {};
}

// ----------------------------------------------------------------------------
// Server
// ----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;

  // CORS preflight
  if (req.method === "OPTIONS") {
    jsonResponse(res, 204, {});
    return;
  }

  // Health check
  if (req.method === "GET" && pathname === "/health") {
    jsonResponse(res, 200, {
      status: "ok",
      server: SERVER_ENV,
      uptime: process.uptime(),
    });
    return;
  }

  // Jira JQL Search (✅ non-deprecated API)
  if (req.method === "GET" && pathname === "/api/jira/search") {
    try {
      const jiraUrl = clean(parsedUrl.query.jiraUrl);
      const jql = clean(parsedUrl.query.jql);
      const fields = clean(parsedUrl.query.fields);
      const maxResults = Number(clean(parsedUrl.query.maxResults || 50));
      const auth = JSON.parse(clean(parsedUrl.query.auth || "{}"));

      if (!jiraUrl || !jql) {
        jsonResponse(res, 400, { error: "Missing jiraUrl or jql" });
        return;
      }

      const headers = buildAuthHeader(auth);
      headers["Content-Type"] = "application/json";

      const targetUrl =
        `${jiraUrl}/rest/api/3/search/jql` +
        `?jql=${encodeURIComponent(jql)}` +
        `&maxResults=${maxResults}` +
        (fields ? `&fields=${encodeURIComponent(fields)}` : "");

      console.log("[JIRA →]", targetUrl);

      const result = await proxyRequest(targetUrl, {
        method: "GET",
        headers,
      });

      jsonResponse(res, result.status, JSON.parse(result.body));
      return;
    } catch (err) {
      console.error("[Proxy Jira Error]", err);
      jsonResponse(res, 500, { error: err.message });
      return;
    }
  }

  // Xray Cloud Authentication
  if (req.method === "POST" && pathname === "/api/xray/authenticate") {
    try {
      const body = JSON.parse(await readBody(req));

      const result = await proxyRequest(
        "https://xray.cloud.getxray.app/api/v1/authenticate",
        { method: "POST", headers: { "Content-Type": "application/json" } },
        JSON.stringify(body)
      );

      jsonResponse(res, result.status, JSON.parse(result.body));
      return;
    } catch (err) {
      console.error("[Proxy Xray Auth Error]", err);
      jsonResponse(res, 500, { error: err.message });
      return;
    }
  }

  // Xray Cloud GraphQL
  if (req.method === "POST" && pathname === "/api/xray/graphql") {
    try {
      const body = await readBody(req);
      const authHeader = req.headers.authorization;

      const result = await proxyRequest(
        "https://xray.cloud.getxray.app/api/v2/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
        },
        body
      );

      jsonResponse(res, result.status, JSON.parse(result.body));
      return;
    } catch (err) {
      console.error("[Proxy Xray GraphQL Error]", err);
      jsonResponse(res, 500, { error: err.message });
      return;
    }
  }

  // Not found
  jsonResponse(res, 404, { error: "Not found" });
});

// ----------------------------------------------------------------------------
// Start server
// ----------------------------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ XRAY TEST DASHBOARD PROXY SERVER                                          ║
║                                                                           ║
║ Running on:  http://localhost:${PORT}                                     ║
║ Health:      http://localhost:${PORT}/health                              ║
║ Platform:    ${SERVER_ENV.platform} | Node ${SERVER_ENV.nodeVersion}      ║
║ PID:         ${SERVER_ENV.pid}                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down proxy server...");
  server.close(() => process.exit(0));
});