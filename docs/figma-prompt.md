# AuCourant: Paste-ready Figma prompt

Copy everything below the line into Figma (Make or AI design). Attach `figma-brief.md` if the tool accepts files.

---

Design a **mobile app for Android**, 360 by 800 frames, light theme only. The app is called **AuCourant**. Tagline: "Stay au courant with your MoMo."

**What it does:** A church treasurer uses it on one shared phone. The app reads mobile money (MoMo) payment messages on the phone, groups received money by reference (Offering, Tithe, Harvest, Thanksgiving, Welfare), suggests merging similar references (like "Thanksgiving" and "Thanks giving") for the treasurer to confirm, and exports a report as PDF or Excel (CSV). Everything stays on the phone. Goal: a sorted report in about 3 minutes.

**Style:** calm, plain, trustworthy. Church money, so no hype and no decoration.

**Hard rules**
- No gradients on buttons. One solid accent. No glass or blur. No cartoon people or mascots.
- No icons inside text inputs unless functional (search, clear). No pill wrappers around plain text.
- Font: Inter. Weights 400, 500, 600 only. Sizes 12 (meta only), 14, 16, 20, 24, 32. List rows are 14 or 16.
- 8pt grid, 4pt for small gaps. Side padding 16. Touch targets at least 48.
- Colours: canvas `#F6F6F3`, surface `#FFFFFF`, text `#1A1A1A`, secondary text `#5B5B57`, accent `#0F6B55`, soft accent `#E4F1ED`, warning `#8A5A00` on `#FFF4DB`, error `#B3261E` on `#FCEDEB`. Borders 1px at 10% black. Radius 8 (12 for bottom sheets). Shadow only on app bar and bottom sheets, under 8% opacity.
- Every list sits in a white surface with a 1px border and hairline row dividers.
- Status never by colour alone. Add text.
- Buttons start with a verb in sentence case. Never use OK, Submit, Proceed, Continue.
- Every input has a visible label. Placeholders only show format.
- Errors never blame, two sentences max, always say how to recover.
- Every empty state: headline, one sentence of value, one action button.

**Navigation:** bottom bar with 4 tabs (Home, Groups, Transactions, Export). Settings gear in the Home app bar. Quick choices use bottom sheets. Destructive actions use a dialog that names the item.

**Screens to design**
1. **First run:** Welcome ("Sort your MoMo money by reference", button "Allow message access"), Permission denied, Scanning inbox with progress ("Reading messages… 120 of 480"), Scan complete summary with button "Review results".
2. **Home (dashboard):** service selector, big number "GHS 4,310.00 received, 38 payments", Top groups list, a warning card "5 need a decision" (2 suggested merges, 3 with no reference, 1 message not read) with button "Review now", button "Export report".
3. **Groups (list):** search labelled "Search groups", rows with name, count, total, a pinned "No reference" system group.
4. **Group detail:** total, list of payments, menu with "Rename group" and "Merge into another group".
5. **Transactions (list):** search labelled "Search payments", filter chips (This service, All groups, No reference), rows with sender, date, reference, amount.
6. **Transaction detail:** Amount, From, Received, Reference, Group, Transaction ID, Fee, expandable "Original message", button "Change group".
7. **Review queue:** tabs Merges, No reference, Not read. Merge card shows two groups with counts and totals, buttons "Confirm merge" and "Keep separate", with a confirmation dialog. No reference list has checkboxes and an "Assign group" bottom sheet with "Create new group". Not read list has "Copy message" and "Skip message".
8. **Export (form):** Period dropdown, Format (PDF or Excel CSV), checklist "Include in report" (Group, Date, Time, Amount, Reference, Transaction ID, Sender name, Sender number), switch "Hide member names and numbers" off by default, summary line, button "Export report". Success state with "Share file" and "Open file". Error state.
9. **Create service (bottom sheet):** Service name, Date, Start time, End time, button "Save service".
10. **Settings:** Scan messages again, App lock switch, Networks supported, About AuCourant, Delete all data (with named confirmation dialog).

**States:** for each screen design loading, first-use empty, filtered empty (where search or filters exist), error, and populated. Empty and loading keep the same frame as populated, so nothing jumps.

**Sample data (fake):** Offering GHS 2,450.00 (22 payments), Tithe GHS 980.00 (9), Harvest GHS 420.00 (4), Thanksgiving GHS 840.00 (12), Welfare GHS 200.00 (3), No reference GHS 120.00 (3). Senders: Akosua Mensah, Kofi Boateng, Ama Owusu, Yaw Darko, Efua Quaye. Currency "GHS 2,450.00". Date "28 Oct 2026".

**Build a component set** with default, pressed, disabled, focused and error states: buttons, text field, search, chips, checkbox, radio, switch, list rows, cards, bottom sheet, dialog, progress bar, skeleton rows. Use Figma variables for colour, spacing, and type. Name frames like `A1 Welcome`, `B Home`.

**Do not design:** budgeting, charts, login, cloud sync, dark mode, tablet, or iPhone.
