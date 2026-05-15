# HRCattopia — Handoff Document

> Auto-updated after every editing session. Last updated: 2026-05-14 (Android loading fixes).

---

## Goal We're Working Toward

A full-featured HR management platform for small-to-medium Malaysian businesses (Cattopia brand). It covers staff lifecycle, attendance, payroll (EPF/SOCSO/PCB compliant), leave, freelancers, shift scheduling, and company announcements — served through a desktop admin panel and a mobile-first staff PWA.

---

## Project Snapshot

| Item | Detail |
|---|---|
| Stack | React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Supabase (Postgres, Auth, Row-Level Security, Edge Functions) |
| Routing | React Router v6 |
| Forms | react-hook-form + zod |
| Theme | Azure executive — Inter font, `blue-600` primary |
| Notifications | Telegram Bot API via Supabase Edge Functions |

---

## Roles & Routing

| Role | Landing Route |
|---|---|
| `admin` | `/admin/dashboard` |
| `area_manager` | `/admin/schedules` |
| staff | `/staff/dashboard` |

---

## Feature Inventory (what's built)

### Admin Panel (`/admin/*`)
- **Dashboard** — KPI cards, headcount, attendance overview, announcements feed
- **Company Settings** — logo, name, GPS radius, Telegram config
- **Branches** — branch list with map (`BranchMap.tsx`, Google Maps API)
- **Staff** — full CRUD, employment status wizard, role timeline, allowances dialog
- **Live Attendance** — real-time check-in/out grid
- **Attendance Records** — filterable history + MIA confirmation
- **Payroll** — batch processing with OT approval, bonus column, YTD summary, tax compliance, statutory exports (EPF/SOCSO/PCB CSV)
- **Freelancers** — separate invoicing flow
- **Schedules** — shift scheduling (area_manager accessible)
- **Approvals** — leave + OT approval inbox
- **HR** — announcements, disciplinary records (5 types), onboarding checklists, shift-swap requests, salary advances, leave balances, probation tracking
- **Management** — (executive-level views)

### Staff Mobile (`/staff/*`)
- **Home** — clock in/out (GPS-gated), live timer, announcements banner
- **Logs** — personal attendance history
- **Leave** — apply + track leave requests
- **Payslips** — monthly payslip viewer
- **Invoices** — freelancer invoice submission
- **Profile** — personal details + password reset

---

## Database: Key Tables

| Table | Purpose |
|---|---|
| `staff_profiles` | Core staff records |
| `attendance_logs` | Clock-in/out events, GPS coords, `ot_approved` flag |
| `payroll_runs` | Monthly payroll per staff; includes `bonus` column |
| `leave_requests` | Staff leave applications |
| `announcements` | Company-wide notices with expiry |
| `disciplinary_records` | Warning / suspension history |
| `onboarding_checklists` | Per-staff onboarding task completion |
| `shift_swap_requests` | Staff-initiated swap, admin approval |
| `mia_records` | Admin-confirmed MIA dates per payroll month |
| `salary_advances` | Advance requests and approval |

---

## Latest Migrations (chronological)

```
20260508000000 — attendance_audit_logs
20260508200001 — HR feature pack (leave balances, allowances, statutory, advances, probation)
20260508300001 — Feature Pack 2 (bonus, announcements, disciplinary, onboarding, shift swaps)
20260510000001 — add ot_approved to attendance_logs
20260513000001 — mia_records table (most recent)
```

---

## Files Most Recently Edited

| File | What changed |
|---|---|
| `src/App.tsx` | All admin + staff pages now lazy-loaded (React.lazy + Suspense) |
| `src/contexts/AuthContext.tsx` | Role fetch: 3 retries × 5s timeout each; localStorage cache (12h TTL) fallback |
| `src/components/InAppBrowserBanner.tsx` | **New** — detects WhatsApp/Telegram/FB in-app browsers, shows "Open in Chrome" banner |
| `src/components/StaffLayout.tsx` | Added InAppBrowserBanner |
| `vite.config.ts` | Added vite-plugin-pwa — generates sw.js + workbox caching |
| `public/manifest.json` | **New** — PWA manifest (name, theme, standalone display) |
| `index.html` | Added manifest link + apple-mobile-web-app meta tags |

---

## What Has Failed / Been Tried

- **Mocked Supabase in tests** — not used; all data ops hit real Supabase (no mock layer).
- **OT approval on the schedule page** — tried, moved to payroll batch review (Option D) because schedule context lacked payroll state.
- **Telegram via Lovable edge proxy** — failed; rewrote all Telegram edge functions to call the Bot API directly.
- **GPS polling on every render in StaffHome** — caused lag; isolated into a dedicated hook with controlled re-render.

---

## Android Loading Fix (2026-05-14)

Root causes and fixes applied:

| Cause | Fix |
|---|---|
| WhatsApp/Telegram in-app browser resets localStorage → session lost | `InAppBrowserBanner.tsx` detects WebView UA and prompts "Open in Chrome" |
| Role fetch timeout (8s) → null role → silent redirect to login on slow 4G | 3 retries × 5s + localStorage role cache as last-resort fallback |
| No caching — full bundle re-downloaded every visit | `vite-plugin-pwa` generates a service worker that caches the app shell |
| Admin code (xlsx, jsPDF, recharts) downloaded by staff | All pages lazy-loaded; staff only download staff chunks |

Main bundle after fix: `601 kB` raw (vendor + shared); page chunks are 4–50 kB each loaded on demand. Service worker (`sw.js`) caches all static assets.

---

## Next Steps (to be updated each session)

- [ ] Wire MIA records UI into the Attendance Records page (confirmation dialog + per-staff MIA count in payroll)
- [ ] Payslip PDF generation (jsPDF is already in dependencies)
- [ ] Shift-swap notification to Telegram when admin approves/rejects
- [ ] Area Manager role scoping — confirm which admin pages they can see beyond Schedules
- [ ] E2E Playwright tests for check-in flow and payroll run
- [ ] Add proper 192×192 and 512×512 PNG icons for PWA (currently only favicon.ico)

---

_This file is maintained manually at the end of each editing session. If it looks stale, check `git log --oneline -5` for what actually changed._
