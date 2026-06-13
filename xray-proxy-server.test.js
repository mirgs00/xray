/**
 * Xray Proxy Server Tests
 * Uses Node.js built-in test runner (node:test)
 * Run with: node --test xray-proxy-server.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Set required env vars before requiring the server
process.env.JIRA_EMAIL = 'test@example.com';
process.env.JIRA_API_TOKEN = 'test-token';
process.env.XRAY_CLIENT_ID = 'test-client-id';
process.env.XRAY_CLIENT_SECRET = 'test-client-secret';

let baseUrl;
const envPath = path.join(__dirname, 'server-env.js');

before(async () => {
  // Create mock server-env.js BEFORE any require.resolve calls
  fs.writeFileSync(envPath, `module.exports = {
    JIRA_EMAIL: 'test@example.com',
    JIRA_API_TOKEN: 'test-token',
    XRAY_CLIENT_ID: 'test-client-id',
    XRAY_CLIENT_SECRET: 'test-client-secret',
    JIRA_BASE_URL: 'https://test.atlassian.net',
    JIRA_PROJECT_KEY: 'TEST'
  };`);

  // Clear require cache to pick up our env vars
  try { delete require.cache[require.resolve('./server-env.js')]; } catch {}
  try { delete require.cache[require.resolve('./xray-proxy-server.js')]; } catch {}

  // Start the server
  require('./xray-proxy-server.js');

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 500));
  baseUrl = 'http://localhost:3001';
});

after(() => {
  try { fs.unlinkSync(envPath); } catch {}
});

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          json: () => JSON.parse(data)
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

describe('Health endpoint', () => {
  it('GET /health returns 200 with correct structure', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.server);
    assert.ok(body.server.platform);
    assert.ok(body.server.nodeVersion);
    assert.ok(body.config);
    assert.equal(body.config.jiraConfigured, true);
    assert.equal(body.config.xrayConfigured, true);
  });

  it('includes CORS headers', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.headers['access-control-allow-origin'], '*');
  });

  it('includes request ID header', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.ok(res.headers['x-request-id']);
  });
});

describe('CORS handling', () => {
  it('OPTIONS returns 204', async () => {
    const res = await fetch(`${baseUrl}/api/jira/search`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
  });
});

describe('Config endpoint removed', () => {
  it('GET /api/config returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.equal(res.status, 404);
  });
});

describe('Jira search validation', () => {
  it('GET /api/jira/search without params returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/jira/search`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });
});

describe('Xray GraphQL validation', () => {
  it('POST /api/xray/graphql with empty body returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/xray/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });
});

describe('Unknown routes', () => {
  it('returns 404 for unknown paths', async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(res.status, 404);
  });
});

describe('Request body size limit', () => {
  it('rejects oversized request bodies', async () => {
    const largeBody = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1 byte
    const res = await fetch(`${baseUrl}/api/xray/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
  });
});
