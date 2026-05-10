## Host Dashboard — Single Page

Build a single scrollable host dashboard at `/` with three stacked sections, 680px max-width centered. All data hardcoded in `src/routes/index.tsx` (replacing the placeholder).

### Sections

1. **Daily Briefing** — secondary background, 3px teal left border, right-only rounded corners, uppercase teal label + paragraph of action items.
2. **Upcoming Bookings** — uppercase muted header + two `BookingCard`s mapped from a `bookings` array. Each card shows dates + status badge (green Active / blue Upcoming), turnover info, and a 3-step checklist (Notified / Confirmed / Done) as equal-width clickable boxes. Completed = green bg + check icon, incomplete = gray bg + circle icon. State held in `useState`, toggled on click.
3. **Gaps & Pricing** — uppercase muted header + table with columns Dates / Nights / Avg price / Flag. "Min stay 3" rendered in warning color when nights < 3.

### Design Tokens

Add to `src/styles.css`:
- `--color-background-primary`, `--color-background-secondary`
- `--color-text-primary`, `--color-text-muted`
- `--color-border-tertiary`
- `--color-teal` (#1D9E75), `--color-status-green`, `--color-status-blue`, `--color-warning`
- `--border-radius-lg`

Defined in oklch in `:root` and `.dark`. No gradients, no shadows.

### Icons

Use Tabler via CDN `<link>` injected through the route's `head()` (`@tabler/icons-webfont`), then `<i className="ti ti-check" />` / `ti-circle` at 14px. (Avoids adding a new npm dep just for two icons.)

### Component Structure

Single file `src/routes/index.tsx`:
- `Briefing()` — static markup
- `BookingCard({ booking, onToggle })` — renders one card + checklist
- `GapsTable({ gaps })` — renders the table
- `Index()` — owns `bookings` state via `useState`, toggle handler, renders all three sections inside a 680px centered container

No router changes, no new routes, no API calls, no `useEffect`.

### Files Touched

- `src/routes/index.tsx` — replace placeholder with full dashboard
- `src/styles.css` — add the new design tokens
