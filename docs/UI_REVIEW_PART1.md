# ATD QBO Platform - UI Review Part 1

**Reviewed**: 2026-03-30
**Viewport**: Desktop (1280x900), Narrow (800x900)
**Pages**: Dashboard, Purchase Orders, AI Chat
**Reviewer**: Claude (automated visual review via Playwright)

---

## Page 1: Dashboard (/)

### Status: Good

**Desktop Observations**:
- Sidebar navigation is well-structured with clear icon + label pairs
- "Coming Soon" section (Invoices, Bills, Payments) is cleanly separated with "Soon" badges in red
- 4 stat cards (Pending Drafts, POs Today, AI Reviews Today, System Status) are evenly spaced in a row
- Each card has a colored icon on the right (blue, green, purple, teal) providing good visual distinction
- System Status shows green dot + "Connected" text, clear at a glance
- "Recent Activity" section shows "No activity yet." centered in a white card, clean empty state
- Refresh button in top-right is appropriately placed
- Version number (v0.1.0) at bottom of sidebar is subtle and non-intrusive
- ATD Blue (#0462AC) used consistently for active nav highlight

**Desktop Issues**:
- No error banner is visible on dashboard (health check showed QBO token expired, but dashboard does not surface this warning). This is a gap since the user asked about error banner clarity. [Critical]
- Stat card values show "0" but no context about whether data failed to load vs. genuinely zero. A subtle "as of [time]" would help. [Nice-to-Have]
- Large empty space below Recent Activity card when no data exists. Could benefit from a getting-started prompt or quick action buttons. [Nice-to-Have]

**Mobile Observations (800px)**:
- Sidebar collapses to hamburger menu, top bar shows "ATD QBO Platform" title. Clean transition.
- Stat cards reflow to 2x2 grid, properly sized and readable
- All text remains readable, no truncation
- Refresh button stays visible

**Mobile Issues**:
- None observed. Responsive layout works well at 800px.

**Recommendations**:
1. [Critical] Surface QBO connection errors/warnings as a dismissible banner at the top of the dashboard (e.g., "QBO token expired. Refresh on QBO Connect page.")
2. [Nice-to-Have] Add timestamp or "last updated" to stat cards
3. [Nice-to-Have] Add quick-action buttons or getting-started guide when dashboard is empty (e.g., "Create your first PO", "Connect to QBO")

---

## Page 2: Purchase Orders (/purchase-orders)

### Status: Good

**Tab 1: Create New**

**Desktop Observations**:
- Form layout is clean with two sections: "PO Details" and "Line Items"
- Vendor dropdown shows "Select a vendor" with chevron, properly styled
- Required field marked with red asterisk (Vendor *)
- Date field pre-filled with today's date (03/30/2026), uses native date picker
- Memo field has helpful placeholder text "Optional note for this PO"
- Line Items table has proper column headers: Item (optional), Description, Qty, Unit Price, Total
- "+ Add Line" button is blue and clearly visible
- Grand Total displayed right-aligned in bold
- AI Review toggle is ON by default (blue), Auto Approve is OFF (gray). Both properly labeled.
- "Submit for Review" button is prominent blue, good size
- Remove line button (X) is properly disabled when only one line exists

**Desktop Issues**:
- Vendor dropdown and Date field are on the same row but vendor takes ~70% width while date takes ~30%. The date field appears slightly cramped compared to the generous vendor width. [Nice-to-Have]
- The "-- No item --" default in the Item dropdown could be confusing. Consider "Select item (optional)" for clarity. [Nice-to-Have]
- Unit Price input shows "0.00" but has no dollar sign prefix unlike the Total column which shows "$0.00". Inconsistent currency formatting. [Nice-to-Have]

**Tab 2: Pending Drafts**

- Clean empty state: "No pending drafts." centered in a gray card
- Refresh button available in top-right
- No issues observed

**Tab 3: History**

- Clean empty state: "No history yet." centered in a gray card
- Consistent layout with Pending Drafts tab
- No issues observed

**Tab 4: Import from Sheets**

- Clear heading: "Import from Google Sheets"
- Helpful description: "Load purchase order data from your configured Google Sheet."
- Blue "Load from Google Sheets" button with sync icon
- Placeholder text in dashed-border box: 'Click "Load from Google Sheets" to preview data from your configured sheet.'
- Layout is clean and inviting

**Desktop Issues (across tabs)**:
- Tab navigation uses blue underline for active tab, consistent and clear
- All 4 tabs accessible and functional

**Mobile Observations (800px)**:
- Sidebar collapses to hamburger menu correctly
- All 4 tabs remain visible and tappable in a single row
- PO Details form stacks Vendor and Date fields properly (Vendor takes ~60%, Date ~40%)
- Line Items table remains functional but gets tight with all columns
- Submit button and toggles remain visible and properly sized

**Mobile Issues**:
- Line Items table at 800px: the Description column is quite narrow. With longer descriptions, text may overflow or be hard to read. [Nice-to-Have]
- Item dropdown "-- No item --" takes significant width on mobile. [Nice-to-Have]

**Recommendations**:
1. [Nice-to-Have] Add $ prefix to Unit Price input for consistency with Total column
2. [Nice-to-Have] Change "-- No item --" to "Select item (optional)"
3. [Future] Consider a responsive card layout for Line Items on narrow screens instead of a table
4. [Nice-to-Have] Add a subtle icon or illustration to empty states (Pending Drafts, History) to make them feel more polished

---

## Page 3: AI Chat (/ai-chat)

### Status: Good

**Desktop Observations**:
- Clean chat interface with centered empty state
- Blue briefcase/building icon as visual anchor
- "Ask about your QBO data" heading is clear and descriptive
- Subtitle: "Query vendors, POs, and activity using natural language." sets expectations well
- 4 suggested prompt buttons arranged in a 2x2 grid:
  - "Show me today's PO activity"
  - "What vendors do we order from most?"
  - "Check for duplicate POs this week"
  - "Summarize this month's purchases"
- Buttons have clean bordered style, easy to read
- Input bar pinned to bottom with clear placeholder text: "Ask a question... (Enter to send, Shift+Enter for newline)"
- Send button (paper plane icon) on right side, properly disabled when input is empty
- AI Source indicator in top-right: "AI Source: Ollama / Claude" with a gray dot

**Desktop Issues**:
- The AI Source indicator dot is gray, which is ambiguous. It should be green (connected) or red (error) to convey status. Currently it's unclear if AI is connected or not. [Critical]
- "Ollama / Claude" text doesn't indicate which is currently active. Should show the active source (e.g., "Using Claude" or "Using Ollama") or show connection status for each. [Critical]
- Large empty space between the suggested prompts and the input bar. The chat area feels sparse. This is fine for an empty state but could use a subtle background pattern or lighter text. [Nice-to-Have]

**Mobile Observations (800px)**:
- Sidebar collapses properly to hamburger menu
- AI Source indicator moves next to the header, still readable
- Suggested prompt buttons reflow to 2x2 grid, all visible and tappable
- Input bar spans full width with send button, properly sized for touch
- Chat icon and heading remain centered and proportionate

**Mobile Issues**:
- AI Source indicator text "AI Source: Ollama / Claude" is small but readable. No major issue. [Nice-to-Have]

**Recommendations**:
1. [Critical] Make AI Source indicator show actual connection status with color coding (green = connected, red = unavailable, yellow = fallback active)
2. [Critical] Show which AI source is currently active (e.g., "Using Claude API" vs "Using Ollama (local)")
3. [Nice-to-Have] Add a "Clear chat" button for when conversation history exists
4. [Future] Add typing indicator / loading animation for when AI is processing a response

---

## Cross-Page Observations

### Sidebar Navigation
- **Complete**: Dashboard, Purchase Orders, AI Chat, QBO Connect, Settings, Vendor Mapping, System Health, Help & Docs
- **Coming Soon**: Invoices, Bills, Payments (properly marked with red "Soon" badges)
- Active page highlighted with ATD Blue (#0462AC) background
- Icons are consistent SVG style throughout
- Version badge (v0.1.0) at bottom is appropriate

### Color Consistency
- ATD Blue (#0462AC) used for: active nav items, active tab underlines, primary buttons, toggle switches
- Green used for: success states (System Status "Connected")
- Red used for: required field asterisks, "Soon" badges
- Gray (#374151 sidebar) used for: sidebar background, consistent dark theme
- Overall color palette is consistent and professional

### Typography
- Headings are bold, clear hierarchy (h1 for page titles, h2 for sections)
- Body text is readable, good contrast
- Placeholder text is appropriately lighter gray

### Empty States
- All empty states use centered gray text ("No activity yet.", "No pending drafts.", "No history yet.")
- Consistent pattern across pages
- Could benefit from icons or illustrations to feel more polished

### Layout & Spacing
- Consistent padding and margins across all pages
- Cards have subtle borders and white backgrounds, creating clear visual separation
- No content overlaps or misalignment observed

---

## Summary

| Page | Desktop | Mobile (800px) | Critical Issues |
|------|---------|----------------|-----------------|
| Dashboard | Good | Good | Missing error/warning banner for system issues |
| Purchase Orders | Good | Good | None |
| AI Chat | Good | Good | AI Source indicator unclear (no status color, no active source shown) |

**Total Issues Found**: 3 Critical, 8 Nice-to-Have, 3 Future

### Critical Issues (Fix Before Launch)
1. Dashboard: No error banner for QBO token expiry or system warnings
2. AI Chat: AI Source indicator dot is gray/ambiguous, no actual status shown
3. AI Chat: Does not show which AI source is active (Ollama vs Claude)

### Nice-to-Have (Post-Launch Polish)
1. Dashboard: Add timestamp to stat cards
2. Dashboard: Add getting-started actions when empty
3. PO Create: Add $ prefix to Unit Price input
4. PO Create: Rename "-- No item --" to "Select item (optional)"
5. PO Create: Description column narrow on mobile
6. PO tabs: Add icons/illustrations to empty states
7. AI Chat: Add subtle background to empty chat area
8. AI Chat: AI Source text small on mobile

### Future Enhancements
1. PO: Card-based line items for mobile
2. AI Chat: Clear chat button
3. AI Chat: Typing/loading indicator
