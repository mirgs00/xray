/**
 * XRAY TEST DASHBOARD – PROXY SERVER
 * FIXED & VERIFIED (Jira + Xray Cloud)
 */

'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const SERVER_ENV = require('./server-env.js');

/* ================= CONFIG ================= */
const PORT = 3001;
const XRAY_BASE_URL = 'https://xray.cloud.getxray.app';
const XRAY_TOKEN_TTL_MS = 55 * 60 * 1000;
const PAGE_SIZE = 100;
const HARD_MAX_ISSUES = 2000;

const DEFAULT_FIELDS = [
  'summary', 'status', 'assignee', 'issuetype',
  'fixVersions', 'labels', 'updated', 'environment'
];

/* ================= FAIL FAST ================= */
(function validateEnv() {
  const missing = [];
  if (!SERVER_ENV.JIRA_EMAIL) missing.push('JIRA_EMAIL');
  if (!SERVER_ENV.JIRA_API_TOKEN) missing.push('JIRA_API_TOKEN');
  if (!SERVER_ENV.XRAY_CLIENT_ID) missing.push('XRAY_CLIENT_ID');
  if (!SERVER_ENV.XRAY_CLIENT_SECRET) missing.push('XRAY_CLIENT_SECRET');
  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '));
    process.exit(1);
  }
})();

/* ================= SERVER INFO ================= */
const SERVER_INFO = {
  hostname: os.hostname(),
  platform: process.platform,
  nodeVersion: process.version,
  pid: process.pid,
  startTime: new Date().toISOString()
};

/* ================= AUTH ================= */
const JIRA_AUTH = {
  email: SERVER_ENV.JIRA_EMAIL,
  token: SERVER_ENV.JIRA_API_TOKEN
};

let XRAY_TOKEN_CACHE = { token: null, expiresAt: 0 };

/* ================= HELPERS ================= */
function json(res, status, body, reqId) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Request-Id': reqId
  });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let rejected = false;
    req.on('data', c => {
      totalBytes += c.length;
      if (!rejected && totalBytes > MAX_BODY_BYTES) {
        rejected = true;
        reject(new Error('Request body too large'));
        return;
      }
      if (!rejected) chunks.push(c);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString());
    });
    req.on('error', reject);
  });
}

function jiraAuthHeader() {
  return {
    Authorization: 'Basic ' + Buffer.from(`${JIRA_AUTH.email}:${JIRA_AUTH.token}`).toString('base64')
  };
}

/* ================= CORE PROXY ================= */
function proxyRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      },
      res => {
        let data = '';
        res.on('data', d => (data += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/* ================= JIRA SEARCH ================= */
async function jiraSearchBounded(jiraUrl, jql) {
  let startAt = 0;
  const issues = [];
  while (true) {
    const url = `${jiraUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=${DEFAULT_FIELDS.join(',')}`;
    const r = await proxyRequest(url, { headers: jiraAuthHeader() });
    if (r.status !== 200 || !r.data?.issues) break;
    issues.push(...r.data.issues);
    if (r.data.issues.length < PAGE_SIZE) break;
    startAt += PAGE_SIZE;
    if (issues.length >= HARD_MAX_ISSUES) break;
  }
  return {
    totalReturned: issues.length,
    truncated: issues.length >= HARD_MAX_ISSUES,
    issues: issues.slice(0, HARD_MAX_ISSUES)
  };
}

/* ================= XRAY AUTH ================= */
async function getXrayToken() {
  if (XRAY_TOKEN_CACHE.token && Date.now() < XRAY_TOKEN_CACHE.expiresAt) {
    return XRAY_TOKEN_CACHE.token;
  }
  const r = await proxyRequest(
    `${XRAY_BASE_URL}/api/v2/authenticate`,
    { method: 'POST' },
    { client_id: SERVER_ENV.XRAY_CLIENT_ID, client_secret: SERVER_ENV.XRAY_CLIENT_SECRET }
  );
  if (r.status !== 200) throw new Error('XRAY_AUTH_FAILED');
  XRAY_TOKEN_CACHE = { token: r.data, expiresAt: Date.now() + XRAY_TOKEN_TTL_MS };
  return r.data;
}

/* ================= HTTP ROUTER ================= */
const server = http.createServer(async (req, res) => {
  const reqId = crypto.randomUUID();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'OPTIONS') {
    return json(res, 204, null, reqId);
  }

  try {
    /* ---------- HEALTH ---------- */
    if (pathname === '/health') {
      return json(res, 200, {
        status: 'ok',
        server: SERVER_INFO,
        config: {
          jiraConfigured: !!JIRA_AUTH.email,
          xrayConfigured: !!SERVER_ENV.XRAY_CLIENT_ID
        }
      }, reqId);
    }

    /* ---------- JIRA SEARCH ---------- */
    if (req.method === 'GET' && pathname === '/api/jira/search') {
      if (!query.jiraUrl || !query.jql) {
        return json(res, 400, { error: 'jiraUrl and jql required' }, reqId);
      }
      const result = await jiraSearchBounded(query.jiraUrl, query.jql);
      return json(res, 200, result, reqId);
    }

    /* ---------- PROJECT VERSIONS ---------- */
    if (req.method === 'GET' && pathname === '/api/jira/projectVersions') {
      if (!query.jiraUrl || !query.projectKey) {
        return json(res, 400, { error: 'jiraUrl and projectKey required' }, reqId);
      }
      const r = await proxyRequest(
        `${query.jiraUrl}/rest/api/3/project/${query.projectKey}/versions`,
        { headers: jiraAuthHeader() }
      );
      return json(res, r.status, r.data, reqId);
    }

    /* ---------- XRAY GRAPHQL ---------- */
    if (req.method === 'POST' && pathname === '/api/xray/graphql') {
      const body = JSON.parse(await readBody(req) || '{}');
      if (!body.query) {
        return json(res, 400, { error: 'Missing GraphQL query' }, reqId);
      }
      const token = await getXrayToken();
      const r = await proxyRequest(
        `${XRAY_BASE_URL}/api/v2/graphql`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        body
      );
      return json(res, r.status, r.data, reqId);
    }

    json(res, 404, { error: 'Not found' }, reqId);
  } catch (e) {
    console.error('[' + reqId + ']', e.stack || e.message);
    json(res, 500, { error: e.message }, reqId);
  }
});

/* ================= START ================= */
server.listen(PORT, () => {
  console.log(`✅ Xray proxy running on http://localhost:${PORT}`);
});
