# ATD QBO Platform - UI Review Part 3

**Reviewed**: 2026-03-30
**Viewport**: Desktop (1280x900), Narrow (800x900)
**Pages**: System Health, Help & Docs
**Reviewer**: Claude (automated visual review via Playwright)

---

## Page 1: System Health (/health)

### Status: Good

**Desktop Observations**:
- Overall status banner is prominently displayed at the top in a yellow/amber card with warning icon: "System Degraded" with subtitle "Some non-critical services are unavailable. Core functionality may be limited." Very clear and informative.
- "Last checked 9:06:43 PM" timestamp shown next to the subtitle, confirms live data.
- "Auto-refreshes every 60 seconds" footer is visible at bottom right. Useful indicator.
- Version 1.0.0 shown at bottom left of main content.
- Refresh button properly placed in top-right header area.
- 5 service cards displayed vertically, each with:
  - Service icon (colored, matching the service)
  - Service name as h3 heading
  - Color-coded status badge: green "Connected" or amber/yellow "Unavailable"
  - Description text explaining the current state
  - Key-value metadata (Latency, Realm ID, Environment, Token expires, Model, Sheet ID, URL)
- Card border colors match status: green-bordered for connected services, amber-bordered for unavailable (Ollama)
- **Firestore Database**: Green, 78ms latency. Clean and minimal.
- **QuickBooks Online**: Green, shows "Connected to American Tile Depot", Realm ID, environment (production), token expiration date. Very thorough.
- **Ollama (Local AI)**: Amber/yellow "Unavailable", shows URL. Clear that it is expected to be local.
- **Claude API**: Green, shows model name (claude-sonnet-4-20250514) and latency.
- **Google Sheets**: Green, shows sheet name ("Shopify order data for QBO") and truncated Sheet ID.
- "1 Action Required" section at bottom with amber warning icon and numbered list:
  - "Ollama is not running. Start it with: ollama serve" - Clear, actionable, includes the exact command.

**Desktop Issues**:
- QBO token expiration shows "3/29/2026, 9:49:53 PM" which is in the past (token already expired). The status still shows green "Connected" because the last health check tested the token before it expired. This could be misleading. The health check API from earlier showed "unhealthy" with expired token, but this page may have cached the last successful check. [Critical]
- The "Version 1.0.0" at bottom of health page content conflicts with "v0.1.0" in the sidebar footer. Two different version numbers on the same page. [Critical]

**Mobile Observations (800px)**:
- Sidebar collapses to hamburger menu properly
- Status banner remains full-width and readable
- Service cards stack vertically, full-width. All metadata readable.
- Refresh button stays visible in header
- Card borders and status colors remain clear
- All text readable without truncation

**Mobile Issues**:
- None observed. Responsive layout is excellent.

**Recommendations**:
1. [Critical] Fix version number inconsistency: sidebar shows v0.1.0, health page content shows Version 1.0.0. Pick one and make it consistent.
2. [Critical] QBO card should show yellow/warning status when token is expired (even if the last connection test passed), since the token_expires_at is in the past.
3. [Nice-to-Have] Add a "Refresh Token" action button directly in the QBO card when token is expired, linking to QBO Connect page.
4. [Nice-to-Have] Consider adding a visual progress bar or countdown for auto-refresh timer.

---

## Page 2: Help & Docs (/help)

### Status: Good

**Tab 1: Quick Start**

**Desktop Observations**:
- Clean layout with search bar at top, 3 tab buttons (Quick Start, User Guide, Troubleshooting) with icons
- Expand All / Collapse All links in blue, properly positioned top-right of content area
- First item "Before You Begin" is expanded by default, showing: "Make sure you have the app URL. If you do not have it yet, ask Toros."
- 7 accordion items total: Before You Begin, Step 1-5, You Are Ready
- Chevron icons (right-arrow collapsed, down-arrow expanded) indicate state clearly
- Steps are numbered logically for onboarding
- Contact footer: "For any issue not listed here, contact Toros Asik." centered at bottom in gray

**Desktop Issues**:
- None observed. Clean and well-organized.

**Tab 2: User Guide**

**Desktop Observations**:
- 11 accordion items covering all major features
- First item "What This App Does" expanded by default with a clear, plain-language description
- Topics cover the full workflow: Dashboard, Creating PO, Reviewing Drafts, Importing from Sheets, PO History, AI Chat, Settings, System Health, FAQ
- "Settings (For Managers Only)" clearly indicates restricted access

**Desktop Issues**:
- None observed. Content is comprehensive and well-structured.

**Tab 3: Troubleshooting**

**Desktop Observations**:
- 12 troubleshooting items covering all common scenarios
- First item "Page Won't Load / Blank Screen" expanded by default
- Each item follows a consistent structure: PROBLEM, CAUSE, FIX (numbered steps), "If that does not work" escalation
- Section labels (PROBLEM, CAUSE, FIX) are in bold uppercase, creating clear visual hierarchy
- Fix steps are numbered ordered lists, easy to follow
- Every item ends with escalation path: "Contact Toros" with specific info to include
- Topics are practical and relevant: token expired, vendor dropdown empty, PO submission fails, Sheets connection, AI unavailable, etc.

**Desktop Issues**:
- None observed. Excellent troubleshooting guide.

**Search Functionality**:
- Typed "token expired" in search box
- Correctly returned: '1 result for "token expired"' with the matching article
- Search result shows article title '"Token Expired" Error' with a "Troubleshooting" badge indicating which tab it came from
- "Clear" button appears in search box to reset
- Search works across all tabs (not just the currently selected one)
- Tabs are hidden during search, replaced by result count, which is appropriate
- Expand All / Collapse All still available during search

**Search Issues**:
- None observed. Search is fast and accurate.

**Expand All / Collapse All**:
- Both buttons work correctly
- Expand All opens all accordion items simultaneously
- Collapse All closes all items
- State toggles are instant with no lag

**Mobile Observations (800px)**:
- Sidebar collapses to hamburger menu
- Search bar is full-width, properly sized for touch
- 3 tab buttons remain visible in a row, icons + text fit well
- Accordion items are full-width, text is readable
- Expand All / Collapse All links are accessible
- Expanded content (Problem/Cause/Fix sections) reads well on narrow screens
- No horizontal scrolling

**Mobile Issues**:
- Tab button text is slightly small at 800px but still readable. At narrower widths (like 375px phone) the three tabs with icons might start to feel cramped. [Future]

**Recommendations**:
1. [Nice-to-Have] Highlight the matched search term within the result title (bold or yellow highlight on "token expired")
2. [Nice-to-Have] Add keyboard shortcut hint (e.g., Ctrl+K or /) to focus the search box
3. [Future] For very narrow mobile screens, consider stacking tabs vertically or using a dropdown selector

---

## Overall Platform Assessment

### Sidebar Navigation

**All 8 items present and accounted for**:
1. Dashboard (/)
2. Purchase Orders (/purchase-orders)
3. AI Chat (/ai-chat)
4. QBO Connect (/qbo-connect)
5. Settings (/settings)
6. Vendor Mapping (/vendor-management)
7. System Health (/health)
8. Help & Docs (/help)

**Sidebar Order**: Logical. Primary workflow items first (Dashboard, Purchase Orders), then tools (AI Chat, QBO Connect), then configuration (Settings, Vendor Mapping), then reference (System Health, Help & Docs). Good information architecture.

**"COMING SOON" Section**: Clearly separated by a divider line and "COMING SOON" label in uppercase gray text. Three items listed with red "Soon" badges:
- Invoices
- Bills
- Payments

This is clean and sets appropriate expectations. The red badges create clear visual distinction from active nav items.

**Version Number**: "v0.1.0" visible at bottom of sidebar in small gray text. Subtle but findable. Note: conflicts with "Version 1.0.0" shown on the System Health page content area.

### Color Scheme Consistency

| Element | Color | Usage | Consistent? |
|---------|-------|-------|-------------|
| ATD Blue (#0462AC) | Primary blue | Active nav, primary buttons, tab underlines, toggles | Yes |
| Sidebar background | #374151 (dark gray) | Navigation area | Yes |
| Connected/Success | Green (#16A34A) | Status badges, System Status dot | Yes |
| Warning/Degraded | Amber/Yellow (#F59E0B) | Degraded banner, Unavailable badge, Action Required | Yes |
| Error/Required | Red | Required field asterisks, "Soon" badges | Yes |
| Card backgrounds | White (#FFFFFF) | Content cards | Yes |
| Page background | Light gray (#F9FAFB) | Main content area | Yes |
| Text primary | Dark gray/black | Headings and body text | Yes |
| Text secondary | Medium gray (#6B7280) | Subtitles, placeholders, descriptions | Yes |

Overall color palette is consistent and professional across all reviewed pages.

### Font Consistency

- Headings: Bold, clear hierarchy (h1 page titles, h2 sections, h3 card headings)
- Body text: Regular weight, readable size (~14-16px)
- Labels: Uppercase, smaller, gray for metadata labels (Latency, Realm ID, etc.)
- Consistent font family throughout (appears to be system font stack / Inter)
- No font inconsistencies observed across any page

### Spacing Consistency

- Consistent padding within cards (~16-24px)
- Consistent gap between cards (~16px)
- Page header spacing consistent: h1 + subtitle + action button pattern used everywhere
- Sidebar item spacing is uniform
- No cramped or overly spacious areas

### Professional Quality: 8.5 / 10

**Strengths**:
- Clean, modern design language consistent across all pages
- Excellent color-coded status system on System Health page
- Comprehensive, well-written help documentation with search
- Responsive design works well at 800px breakpoint
- Logical navigation structure
- Good use of icons throughout (sidebar, tabs, status cards)
- Accordion pattern used consistently for collapsible content
- Empty states are clean and informative
- Error/warning states use appropriate colors and clear messaging

**Areas preventing a 9 or 10**:
- Version number inconsistency (v0.1.0 vs 1.0.0)
- No error banner on Dashboard for system issues (identified in Part 1 review)
- AI Source indicator on AI Chat is ambiguous (identified in Part 1 review)
- Some minor inconsistencies ($ prefix on totals but not inputs, "-- No item --" wording)
- No dark mode option
- No loading skeletons (shows "Loading" text instead of skeleton placeholders)

---

## Top 5 Priority Improvements

1. **[Critical] Fix version number inconsistency** - Sidebar shows v0.1.0, Health page shows Version 1.0.0. Pick one source of truth and display it consistently everywhere.

2. **[Critical] Add Dashboard error/warning banner** - The Dashboard should surface system warnings (e.g., QBO token expired, Ollama unavailable) as a dismissible banner. Currently, users must navigate to System Health to discover problems. (From Part 1 review)

3. **[Critical] Fix QBO status when token is expired** - Health page shows QBO as "Connected" even when the token_expires_at timestamp is in the past. Should show yellow/warning with an action to refresh.

4. **[Critical] AI Source indicator needs real status** - The AI Chat page shows a gray dot with "Ollama / Claude" but doesn't indicate which source is active or their connection status. Should show green/red per source and identify the active one. (From Part 1 review)

5. **[Nice-to-Have] Add loading skeletons** - Replace "Loading" text with skeleton placeholder animations for a more polished loading experience across Dashboard stats, Health cards, and vendor dropdowns.

---

## Summary

The ATD QBO Platform is a well-designed internal tool with a professional and consistent UI. The System Health page is a standout, with excellent color-coded status cards, actionable error messages, and auto-refresh functionality. The Help & Docs page is equally impressive, with comprehensive content across three well-organized tabs, working search with result counting, and a consistent accordion pattern. The main areas for improvement are fixing the version number inconsistency, surfacing system warnings on the Dashboard, and making the AI Source indicator functional. These are polish items rather than fundamental design problems. The platform is ready for internal use with these minor fixes.
