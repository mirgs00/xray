/**
 * ═══════════════════════════════════════════════════════════════
 *  XRAY TEST EXECUTION DASHBOARD  ·  Environment Configuration
 * ═══════════════════════════════════════════════════════════════
 *
 *  USAGE
 *  ─────
 *  Place this file in the SAME directory as xray-test-dashboard.html.
 *  The dashboard loads it automatically via <script src="env.js">.
 *
 *  SECURITY
 *  ────────
 *  ⚠  This file contains credentials — never commit it to source
 *     control.  Add "env.js" to your .gitignore.
 *  ⚠  All values are loaded into the browser.  Use a read-only
 *     Jira API token scoped to the minimum required permissions.
 *
 *  FIELDS
 *  ──────
 *  Leave any field as '' if it does not apply to your setup.
 * ═══════════════════════════════════════════════════════════════
 */

window.XRAY_ENV = {

  // ── Jira connection ───────────────────────────────────────────
  /** Full base URL of your Jira instance, no trailing slash.
   *  Cloud example:  'https://your-org.atlassian.net'
   *  Server example: 'https://jira.internal.example.com'       */
  jiraBaseUrl: '',

  /** Default Jira project key shown in the Overview panel.      */
  jiraProjectKey: '',

  // ── Jira authentication ───────────────────────────────────────
  /** Auth mode: 'basic' | 'bearer' | 'xray_cloud'
   *
   *  basic      → Jira Cloud email + API token (most common)
   *  bearer     → Personal Access Token (Jira Server / DC)
   *  xray_cloud → Xray Cloud client_id + client_secret          */
  authMode: 'basic',

  // ── Xray configuration ────────────────────────────────────────
  /** Xray deployment type: 'cloud' | 'server'                   */
  xrayType: 'cloud',



  // ── Dashboard defaults ────────────────────────────────────────
  /** Default fix version string pre-filled in the Overview panel.
   *  Leave '' to default to today's date (v2026.04.14 format). */
  defaultFixVersion: '',

  /** Pre-populate the Release A slot in the Compare tab.        */
  compareReleaseA: '',

  /** Pre-populate the Release B slot in the Compare tab.        */
  compareReleaseB: '',
};