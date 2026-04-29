# Xray Test Execution Dashboard

A self-contained, zero-install HTML dashboard for visualizing Xray test execution results from Jira/Xray.

**Version**: 15 - Line Chart + Raven Pagination + Enhanced Failures Tab

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

2. Open `xray-test-dashboard-v15.html` in browser
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
   node xray-proxy-server.js
   # Or on Windows: double-click start-dashboard.bat
   ```

3. Open browser:
   ```
   http://localhost:3001/xray-test-dashboard-v15.html?proxy=local
   ```

---

## File Reference

| File | Purpose | Loaded By |
|------|---------|----------|
| **`env.js`** | Browser-side config (Jira URL, project, auth mode) | Browser `<script>` tag |
| **`server-env.js`** | Server-side API credentials (Node.js only) | `xray-proxy-server.js` via `require()` |
| **`xray-proxy-server.js`** | Proxy server (port 3001, CORS handling) | Node.js runtime |
| **`xray-test-dashboard-v15.html`** | Main dashboard UI | Browser |

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

## Latest Features (v15)

### Failures Tab Enhancements
- ✅ Shows **latest failed run per test** (not all failures)
- ✅ Evidence screenshots with thumbnail + modal popup
- ✅ Execution links (`/browse/{execKey}`)
- ✅ Test links (`/browse/{testKey}`)
- ✅ Stack trace display
- ✅ Failed step highlighting

### Test Executions Tab
- ✅ Quick stats bar (total/filtered counts update with filters)
- ✅ Search + filter by status/env/version/labels
- ✅ Sortable columns (click headers)
- ✅ Pagination (20/page) with prev/next
- ✅ "Clear Filters" button resets all

### Label Analytics Tab
- ✅ Expandable sections per label
- ✅ Latest execution status indicators
- ✅ Sortable test table within sections
- ✅ Search within expanded sections

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
- Node.js 16+
- Jira account with API token
- Xray Cloud or Server/DC instance

### Local Development
```bash
# Terminal 1: Start proxy
npm start
# or
node xray-proxy-server.js

# Terminal 2: Open dashboard
# If using proxy:
open "http://localhost:3001/xray-test-dashboard-v15.html?proxy=local"

# If using browser mode (CORS risk):
open xray-test-dashboard-v15.html
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
| **v15** | Failures tab rewrite, evidence support, Test Executions filtering |
| **v14** | Raven pagination, auto-fetch with cancel |
| **v9-13** | Label analytics, trends, flaky detection |
| **v1-8** | Initial releases, basic functionality |
