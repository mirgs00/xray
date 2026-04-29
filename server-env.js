
/**

 * ═══════════════════════════════════════════════════════════════

 *  XRAY TEST EXECUTION DASHBOARD  ·  secrets (Node.js–only)

 * ═══════════════════════════════════════════════════════════════

 *  module.exports = {

 *    JIRA_EMAIL: '...',

 *    JIRA_API_TOKEN: '...',

 *    XRAY_CLIENT_ID: '...',

 *    XRAY_CLIENT_SECRET: '...'

 *  }

 * ⚠  This file contains credentials — never commit it to source control.  

 *         Add " server-env.js" to your .gitignore.

 * ═══════════════════════════════════════════════════════════════

 */

 

module.exports = {

  // ── Jira connection ───────────────────────────────────────────
  JIRA_BASE_URL: '',           // 'https://your-org.atlassian.net'

  JIRA_PROJECT_KEY: '',        // 'YOURPROJ'

  // ── Jira authentication ───────────────────────────────────────
  JIRA_EMAIL: '',              // Jira Cloud email (for basic auth)

  JIRA_API_TOKEN: '',          // Jira API token (https://id.atlassian.com/manage-profile/security/api-tokens)

  AUTH_MODE: 'basic',          // 'basic' | 'bearer' | 'xray_cloud'

  // ── Xray Cloud credentials ──────────────────────────────────────
  XRAY_CLIENT_ID: '',          // Xray Cloud Client ID (from Xray Settings → API Keys)

  XRAY_CLIENT_SECRET: '',      // Xray Cloud Client Secret

  XRAY_TYPE: 'cloud'           // 'cloud' | 'server'

};

 

