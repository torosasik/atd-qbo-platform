# UI Review Part 2 - ATD QBO Platform

**Date**: 2026-03-29
**Reviewer**: Claude (automated visual review)
**Pages Reviewed**: QBO Connect, Settings, Vendor Management
**Viewports Tested**: Desktop (1280x900), Narrow (800x900)

---

### Page: QBO Connect (/qbo-connect)

**Status**: Good

**Desktop Issues**:
- None. Connection status is clear and prominent with green checkmark icon and "Connected to QuickBooks" heading.
- Realm ID, Token Expires, and Last Refreshed fields are clearly readable with good label/value alignment.
- Refresh Token button (gray/neutral) and Disconnect button (red/destructive) are properly differentiated.
- "Refresh" link in the Connection Status card header is well-placed but could be slightly more prominent.
- Clean, professional layout for the connected state.

**Mobile Issues**:
- None significant. Sidebar collapses to hamburger menu correctly.
- Layout stacks vertically and remains readable at 800px.
- Buttons remain properly sized and tappable.

**Recommendations**:
- [Nice-to-Have] Consider adding a green/red status dot next to "Connection Status" heading for at-a-glance status.
- [Nice-to-Have] The "Refresh" text link in the card header is subtle. Could use an icon-only button or more visible styling.

---

### Page: Settings (/settings)

**Status**: Good

**Desktop Issues**:
- All five sections render correctly: Google Sheets, AI Configuration, QuickBooks Connection, Module Settings, Danger Zone.
- New fields confirmed present and properly rendered:
  - **Header Row**: Number input, compact size (w-24), tooltip present. Displays default value "1".
  - **Data Start Row**: Number input, compact size (w-24), tooltip present. Displays default value "2".
  - **Default Memo Template**: Full-width text input with placeholder "e.g., ATD PO - {{vendor}}". Tooltip present.
  - **Default PO Terms**: Full-width text input with placeholder "e.g., Net 30". Tooltip present.
  - **Max Tokens**: Number input (w-28), displays default "1024". Tooltip present.
  - **AI Review Prompt**: Textarea with 4 rows, full-width, shows default prompt text. Resizable. Tooltip present.
  - **Require AI Review**: New column in Module Settings table with toggle for each module row. Tooltip present on header.
- All InfoTooltip icons (circle-?) are visible next to their labels.
- Save buttons are clearly visible in blue at the bottom of each section card.
- Danger Zone: "Reset to Defaults" button is styled destructively (red text, red border, light red background) and clearly separated from other sections.
- Column mapping dropdowns are compact and well-aligned.

**Mobile Issues**:
- Module Settings table at 800px: the "Payments" row has the "Coming Soon" badge text wrapping to two lines ("Coming" / "Soon"). This is a minor cosmetic issue.
- Module Settings table is tight with 5 columns (Module, Enabled, Auto Approve, Require AI Review, Status) but still fits without horizontal scroll at 800px.
- All form fields stack vertically on narrow widths as expected (via sm:flex-row responsive classes).
- Google Sheets section renders cleanly with labels above inputs.

**Recommendations**:
- [Nice-to-Have] The "Coming Soon" badge on the Payments module row wraps at narrow widths. Consider using a shorter label like "Soon" or abbreviating, or adding `whitespace-nowrap` to the badge.
- [Nice-to-Have] The Module Settings table could benefit from `overflow-x-auto` on even narrower viewports (below 800px) to prevent potential cramping if more columns are added in the future.
- [Future] Consider grouping "Header Row" and "Data Start Row" on the same line since they are related small number inputs.

---

### Page: Vendor Management (/vendor-management)

**Status**: Good

**Desktop Issues**:
- Empty state message is clear: "No vendors synced yet. Click Sync from QuickBooks to get started." displayed in centered, gray text within a white card.
- "Sync from QuickBooks" button is prominent: blue (atd-blue), full-size, with refresh icon. Properly placed in its own white card at the top.
- Page header "Vendor Management" with subtitle "Map QuickBooks vendors to Shopify codes" follows the same pattern as other pages.
- Sidebar correctly highlights "Vendor Mapping" with the Tags icon, positioned after Settings and before System Health.
- Layout spacing is consistent with other pages (p-6, space-y-6).

**Mobile Issues**:
- None. Layout adapts cleanly at 800px.
- Sidebar collapses to hamburger menu.
- Sync button and empty state card are properly sized.
- Text remains readable and properly spaced.

**Recommendations**:
- [Nice-to-Have] The empty state could include a small illustration or icon (e.g., a vendor/store icon) to make it more visually engaging, consistent with modern empty-state patterns.
- [Nice-to-Have] Consider adding a subtle info message explaining what vendor mapping does, since this is a new feature users may not immediately understand.
- [Future] Cannot test the populated table state (with vendors) since no backend data exists yet. Once the backend vendor-mappings endpoints are live, re-test the table layout with 30+ vendors to verify scroll behavior, search filtering, and Select All/Deselect All functionality.

---

## Sidebar Navigation Review

**Order confirmed correct**: Dashboard > Purchase Orders > AI Chat > QBO Connect > Settings > Vendor Mapping > System Health > Help & Docs > [divider] > Coming Soon (Invoices, Bills, Payments)

- Vendor Mapping uses the Tags icon from lucide-react.
- Active state (blue highlight) works correctly when on the /vendor-management route.
- All nav items are properly spaced and aligned.

---

## Overall Assessment

| Area | Rating |
|------|--------|
| Layout & Alignment | Excellent |
| Spacing & Padding | Excellent |
| Text Readability | Excellent |
| Color Consistency | Excellent |
| Empty States | Good |
| Error Displays | Good (yellow warning banner pattern consistent) |
| Mobile Responsiveness | Good |
| New Fields Integration | Excellent |
| Sidebar Navigation | Excellent |

**Summary**: All three pages are production-ready at desktop and 800px widths. The new Settings fields (Header Row, Data Start Row, Default Memo Template, Default PO Terms, Max Tokens, AI Review Prompt, Require AI Review toggle) are properly integrated with correct labels, tooltips, input types, and sizing. The Vendor Management page empty state is clear and actionable. No critical issues found. Minor cosmetic items noted above are all nice-to-have improvements.
