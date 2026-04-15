/**
 * XRAY TEST DASHBOARD PROXY SERVER
 * 
 * Solves CORS issues by proxying requests to Jira/Xray APIs
 * Also provides environment detection and persistent storage
 * 
 * Routes:
 *   GET  /health                    - Health check
 *   GET  /api/jira/search           - Proxy Jira search API
 *   GET  /api/xray/testexec/:key    - Proxy Xray test execution API
 *   POST /api/xray/authenticate     - Xray Cloud authentication
 *   GET  /api/environment           - Get server environment info
 *   POST /api/cache/:key            - Cache API responses
 *   GET  /api/cache/:key            - Retrieve cached responses
 *   
 * Port: 3001
 */

'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');

const PORT = 3001;
const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Environment detection
const SERVER_ENV = {
  platform: process.platform,
  nodeVersion: process.version,
  hostname: require('os').hostname(),
  startTime: new Date().toISOString(),
  isServer: true,
  pid: process.pid
};

// Helper: Read request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// Helper: JSON response with CORS
function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  });
  res.end(JSON.stringify(data));
}

// Helper: Proxy request to target
function proxyRequest(targetUrl, options, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { ...options.headers, 'Host': parsedUrl.hostname }
    };
    
    const req = protocol.request(requestOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Helper: Build Jira auth header
function buildAuthHeader(authConfig) {
  if (authConfig.mode === 'basic') {
    const encoded = Buffer.from(`${authConfig.email}:${authConfig.token}`).toString('base64');
    return { 'Authorization': `Basic ${encoded}` };
  }
  if (authConfig.mode === 'bearer') {
    return { 'Authorization': `Bearer ${authConfig.bearerToken}` };
  }
  return {};
}

// Main server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  
  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }
  
  // Health check
  if (method === 'GET' && pathname === '/health') {
    jsonResponse(res, 200, { 
      status: 'ok', 
      version: '2.0.0',
      server: SERVER_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
    return;
  }
  
  // Get environment info
  if (method === 'GET' && pathname === '/api/environment') {
    jsonResponse(res, 200, SERVER_ENV);
    return;
  }
  
  // Proxy Jira search API
  if (method === 'GET' && pathname === '/api/jira/search') {
    try {
      const jiraUrl = parsedUrl.query.jiraUrl;
      const jql = parsedUrl.query.jql;
      const auth = JSON.parse(parsedUrl.query.auth || '{}');
      
      if (!jiraUrl || !jql) {
        jsonResponse(res, 400, { error: 'Missing jiraUrl or jql parameter' });
        return;
      }
      
      const targetUrl = `${jiraUrl}/rest/api/3/search?${jql}`;
      const headers = buildAuthHeader(auth);
      headers['Content-Type'] = 'application/json';
      
      const result = await proxyRequest(targetUrl, { method: 'GET', headers });
      jsonResponse(res, result.status, result.data);
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
    return;
  }
  
  // Proxy Xray test execution API (Server/DC)
  if (method === 'GET' && pathname.match(/^\/api\/xray\/testexec\//)) {
    try {
      const execKey = pathname.split('/').pop();
      const jiraUrl = parsedUrl.query.jiraUrl;
      const auth = JSON.parse(parsedUrl.query.auth || '{}');
      
      if (!jiraUrl || !execKey) {
        jsonResponse(res, 400, { error: 'Missing jiraUrl or execution key' });
        return;
      }
      
      const targetUrl = `${jiraUrl}/rest/raven/2.0/api/testexec/${execKey}/test?detailed=true`;
      const headers = buildAuthHeader(auth);
      headers['Content-Type'] = 'application/json';
      
      const result = await proxyRequest(targetUrl, { method: 'GET', headers });
      jsonResponse(res, result.status, result.data);
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
    return;
  }
  
  // Xray Cloud authentication
  if (method === 'POST' && pathname === '/api/xray/authenticate') {
    try {
      const body = JSON.parse(await readBody(req));
      const { client_id, client_secret } = body;
      
      const result = await proxyRequest(
        'https://xray.cloud.getxray.app/api/v1/authenticate',
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        JSON.stringify({ client_id, client_secret })
      );
      
      jsonResponse(res, result.status, result.data);
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
    return;
  }
  
  // Xray Cloud GraphQL
  if (method === 'POST' && pathname === '/api/xray/graphql') {
    try {
      const body = await readBody(req);
      const authHeader = req.headers.authorization;
      
      const result = await proxyRequest(
        'https://xray.cloud.getxray.app/api/v2/graphql',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': authHeader } },
        body
      );
      
      jsonResponse(res, result.status, result.data);
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
    return;
  }
  
  // Cache storage
  if (method === 'POST' && pathname.match(/^\/api\/cache\//)) {
    const cacheKey = pathname.split('/').pop();
    const body = await readBody(req);
    CACHE.set(cacheKey, {
      data: body,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });
    jsonResponse(res, 200, { cached: true, key: cacheKey });
    return;
  }
  
  // Cache retrieval
  if (method === 'GET' && pathname.match(/^\/api\/cache\//)) {
    const cacheKey = pathname.split('/').pop();
    const cached = CACHE.get(cacheKey);
    
    if (!cached) {
      jsonResponse(res, 404, { error: 'Not found' });
      return;
    }
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      CACHE.delete(cacheKey);
      jsonResponse(res, 404, { error: 'Expired' });
      return;
    }
    
    jsonResponse(res, 200, JSON.parse(cached.data));
    return;
  }
  
  // 404
  jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║     XRAY TEST DASHBOARD PROXY SERVER                                      ║
║                                                                           ║
║   Running on:  http://localhost:${PORT}                                   ║
║   Health:      http://localhost:${PORT}/health                            ║
║   Environment: ${SERVER_ENV.platform} | Node ${SERVER_ENV.nodeVersion}    ║
║   PID:         ${SERVER_ENV.pid}                                          ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`   Kill the process using: netstat -ano | findstr :${PORT}`);
    console.error(`   Then run: taskkill /PID <PID> /F`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down proxy server...');
  server.close(() => process.exit(0));
});