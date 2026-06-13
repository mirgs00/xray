# Xray Test Execution Dashboard

A self-contained, zero-install HTML dashboard for visualizing Xray test execution results from Jira/Xray.

**Latest Version**: 17 - Security hardening, bug fixes, and improved code quality

## Versions

| Version | Highlights |
|---------|-----------|
| **v17** | Security hardening, bug fixes, improved code quality, automated tests |
| **v15-16** | Line Chart, Raven Pagination, Enhanced Failures Tab (archived) |
| **v14** | Raven pagination, auto-fetch with cancel |
| **v9-13** | Label analytics, trends, flaky detection |
| **v1-8** | Initial releases, basic functionality |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd xray
npm install
```

### 2. Configure Credentials

#### Option A: Browser Mode (Direct API)

1. Copy `env.js` and edit:
   ```javascript
   window.XRAY_ENV = {
     jiraBaseUrl: 'https://your-org.atlassian.net',
     jiraProjectKey: 'YOURPROJ',
     authMode: 'basic',
     xrayType: 'cloud',
     // ... fill in credentials
   }
   ```

2. Open `xray-test-dashboard-v17.html` in browser
3. **Warning**: May hit CORS issues in some browsers

#### Option B: Server Mode (Recommended)

1. Create `server-env.js` (never commit this file!):
   ```javascript
   module.exports = {
     JIRA_EMAIL: 'you@company.com',
     JIRA_API_TOKEN: 'your-api-token',
     XRAY_CLIENT_ID: 'your-xray-client-id',
     XRAY_CLIENT_SECRET: 'your-xray-client-secret'
   }
   ```

2. Start proxy server:
   ```bash
   npm start
   # Or on Windows: double-click start-dashboard.bat
   ```

3. Open browser:
   ```
   http://localhost:3001/xray-test-dashboard-v17.html?proxy=local
   ```

---

## File Reference

| File | Purpose | Loaded By |
|------|---------|----------|
| **`env.js`** | Browser-side config (Jira URL, project, auth mode) | Browser `<script>` tag |
| **`server-env.js`** | Server-side API credentials (Node.js only) | `xray-proxy-server.js` via `require()` |
| **`xray-proxy-server.js`** | Proxy server (port 3001, CORS handling) | Node.js runtime |
| **`xray-test-dashboard-v17.html`** | Main dashboard UI | Browser |

⚠ **Security**: Both `env.js` and `server-env.js` contain credentials.
Add both to `.gitignore` - never commit them!

---

## Dashboard Tabs

| Tab | Description |
|-----|-------------|
| **Overview** | Config panel, metrics cards, pie chart, test table with pagination |
| **Test Executions** | All executions with sorting, filtering, pagination, quick stats |
| **Failures** | Latest failed run per test, evidence screenshots, stack traces |
| **Environments** | Server env & browser breakdown |
| **Trends** | Historical pass rate chart + flaky test detection |
| **Compare Releases** | Side-by-side release comparison |
| **Label Analytics** | Expandable label sections with test details |
| **API Setup** | Authentication & field mapping configuration |

---

## Security Features

- **No credential exposure**: Server credentials stay server-side
- **Session-only storage**: Saved config uses `sessionStorage` (clears on tab close)
- **Request size limits**: Server rejects oversized request bodies (1MB max)
- **Input escaping**: All dynamic HTML content is escaped to prevent XSS

---

## Testing

```bash
npm test
```

Tests cover:
- Health endpoint structure and CORS headers
- Route validation and error handling
- Request body size limits
- Config endpoint removal verification

---

## API Endpoints (Proxy Server)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Server health check |
| `GET /api/jira/search` | Jira JQL search (bypasses CORS) |
| `GET /api/jira/projectVersions` | Fetch project versions |
| `POST /api/xray/graphql` | Xray Cloud GraphQL proxy |

---

## Development

### Prerequisites
- Node.js 18+ (for built-in test runner)
- Jira account with API token
- Xray Cloud or Server/DC instance

### Local Development
```bash
# Start proxy server
npm start

# Or for development (proxy + file server):
npm run dev

# Open browser:
# http://localhost:3001/xray-test-dashboard-v17.html?proxy=local
```

---

## .gitignore

Ensure these files are NEVER committed:
```
env.js
server-env.js
node_modules/
*.log
```

---

## Troubleshooting

### "Unable to create index.lock"
Run as Administrator or delete `.git/index.lock` manually.

### CORS Errors
Use Server Mode (proxy) instead of Browser Mode.

### Evidence Not Showing
- Verify Xray Cloud GraphQL returns `downloadLink` in evidence objects
- Check browser console for 404 errors on evidence URLs
- Ensure `server-env.js` is properly configured for Xray Cloud auth

### server-env.js vs env.js
- `env.js` → Loaded by **browser** via `<script>` tag in HTML
- `server-env.js` → Loaded by **Node.js** proxy server via `require()`
- They serve DIFFERENT purposes - one for browser config, one for server credentials

---

## Version History

| Version | Highlights |
|---------|-----------|
| **v17** | Security hardening, bug fixes, improved code quality, automated tests |
| **v15-16** | Line Chart, Raven Pagination, Enhanced Failures Tab |
| **v14** | Raven pagination, auto-fetch with cancel |
| **v9-13** | Label analytics, trends, flaky detection |
| **v1-8** | Initial releases, basic functionality |
