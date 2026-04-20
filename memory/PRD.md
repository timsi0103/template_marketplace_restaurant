# The Culinary Editorial - F&B E-Commerce Platform PRD

## Architecture
- Frontend: React + Tailwind CSS + Shadcn UI, relative API paths
- Backend: FastAPI + MongoDB (Motor async), JWT + Google OAuth
- Design: Cormorant Garamond + Manrope, #F8F5F0/#6E1C1E/#E55A3D

## Phases Implemented
1. Skeleton Template (8 pages)
2. Authentication (JWT + Google OAuth + Guest)
3. Mobile-First Responsive (bottom nav, cart drawer)
4. Product/Menu Catalog (CRUD, gallery, availability)
5. Categories & Subcategories (hierarchy, landing pages)
6. Modifiers & Add-Ons (required/optional, live pricing)
7. Product Variants (size, weight, pack)
8. Photo Gallery (grid view, lightbox, skeleton loading, admin image management)
9. Operating Hours & Availability
10. Shopping Cart with Real-Time Updates
11. Checkout Flow (5 steps + confirmation + guest)
12. Global Payment Gateway screens
13. Promo Code / Coupon Redemption
14. Order Placement & Confirmation
15. Order History & Reorder
16. Kitchen Display System (KDS)
17. Checkout Bug Fix — 422 on POST /api/orders
18. Admin Accept Order Bug Fix (Feb 2026)
19. Order Ticket Printing / Thermal Printer (Feb 2026)
20. Backend Refactor + Search + Analytics (Feb 2026)
21. Real-Time Order Queue + Audio Alerts (Feb 2026)
22. Prep Time Estimation & Order Throttling (Feb 2026)
23. Quick 86 / Sold-Out Toggle (Feb 2026)
24. Branded Storefront & Admin Customization (Feb 2026)
25. Menu Catalog Browsing & Search Overhaul (Feb 2026)
26. Guest Checkout + Post-Purchase Account Creation (Feb 2026)
27. Sales Dashboard & Reports (Feb 2026)
28. Store Profile & Branding Configuration (Feb 2026)
29. Operating Hours & Holiday Management (Feb 2026)
30. Tax & Service Charge Configuration (Feb 2026)
31. Daily Summary & End-of-Day Report (Feb 2026)
32. SEO Optimization & Structured Data (Feb 2026)
33. Full E2E Regression Sweep (Feb 2026)
34. Order Modification & Cancellation (Feb 2026)
35. Staff Accounts & Role-Based Access (Feb 2026 — current)

### Phase 35 - Staff Accounts & Role-Based Access (Feb 2026)
- [x] Backend `routes/staff.py` (new): 6 pre-defined roles auto-seeded (Owner/Manager/Kitchen/Delivery/Front-of-House/Cashier) with granular permissions across 8 feature areas × 3 actions (view/edit/approve).
- [x] Role CRUD: `GET/POST/PATCH/DELETE /api/admin/roles` + in-use guard (409) + pre-defined edit/delete blocked (403). Custom roles use `pre_defined:false` and sort_order=100.
- [x] Staff CRUD: `GET /api/admin/staff` (with pending invites), `GET/PATCH /api/admin/staff/{user_id}`, `POST /api/admin/staff/{user_id}/deactivate|reactivate`. Self-deactivate blocked (400).
- [x] Invitation lifecycle (**MOCKED email**): `POST /api/admin/staff/invite` returns `{mocked_email:true, accept_url}` + 7-day expiry; `POST /api/admin/staff/invites/{id}/revoke`; public `GET /api/invitations/{token}` (pending/accepted/revoked/expired/notfound) + `POST /api/invitations/{token}/accept` creates user + login-ready password hash.
- [x] Activity aggregator `GET /api/admin/staff/{user_id}/activity` pulls from `order_audit` + `print_jobs` + `staff_activity` collections. Global `GET /api/admin/staff-activity` for dashboard use.
- [x] Frontend: 
  - `/admin/staff` — staff list (name, email, role badge, last-active, status), pending-invite amber rows with Copy-link + Revoke, Invite dialog with role selector + MOCKED-email badge + success state with shareable link.
  - `/admin/staff/{user_id}` — profile page with avatar, role badge, contact info, activity summary, 8-area permission overview (view/edit/approve chips per area), paginated activity log.
  - `/admin/roles` — two tabs: **Role cards** (6 pre-defined + custom) with permission chips, staff counts, Read-only tag on pre-defined; **Permission matrix** sticky-header grid (roles × areas × actions); New/Edit custom role dialog with per-area switch + per-action pill toggles.
  - `/accept-invite/{token}` — public page with pending/accepted/revoked/expired/notfound states; pending renders email-locked form (name, password, confirm) and auto-signs-in + redirects to /admin on success.
- [x] Sidebar: two new entries "Staff" (UserCog) + "Roles" (Shield) — now 27 total admin links.
- [x] Enforcement scope: permissions are **UI-level advisory** in this phase (admin endpoints continue using `require_admin`). Full backend per-permission guards parked as P2 backlog (~60 endpoints).
- [x] Clipboard hardening: both Copy-link calls wrapped in try/catch with graceful toast fallback for insecure contexts.
- [x] Tested: 24/25 pytest pass (1 expected skip — seeded admin lacks `is_staff:True`). Testing agent validated 100% of frontend flows with zero bugs.

### Phase 34 - Order Modification & Cancellation (Feb 2026)
- [x] Backend `routes/order_modification.py` (new):
  - Public `GET /api/cancellation/config` exposes window/reasons/toggles to the storefront.
  - Admin `GET/PATCH /api/admin/cancellation/config` with 0–120 minute cap, self-cancel toggle, auto-refund toggle, require-reason toggle, notify-on-modification toggle, modifiable/cancellable status whitelists.
  - `GET /api/orders/{id}/cancel-eligibility` (public) — eligible flag, `seconds_remaining`, current status, reason list.
  - `POST /api/orders/{id}/cancel` (customer) — gated on window + status + `customer_self_cancel_enabled`; records **MOCKED** refund row (`db.refunds.mocked=True`), flips `payment_status` to `refunded` when `auto_refund=True`, otherwise sets `refund_pending=True`; writes audit entry; emits 409 on already-cancelled / window-closed, 400 on invalid reason, 403 when disabled.
  - `POST /api/admin/orders/{id}/cancel` — admin can cancel any time + optional refund bypass.
  - `POST /api/admin/orders/{id}/modify` — re-enriches items + recomputes totals via existing `_compute_order_totals`, layers optional manual discount on top, stashes `original_total` on first price change, emits `modification_notification` for customer banner, writes audit entry. Gated on `modifiable_statuses`.
  - `POST /api/orders/{id}/acknowledge-modification` (public) — customer dismisses the price banner; idempotent.
  - `GET /api/admin/orders/{id}/audit` — full change log (actor id/role/name, action, old→new changes, reason, timestamp).
  - `GET /api/admin/cancellations` — recent cancellations + reason breakdown.
- [x] Customer UI: `<CancelOrderButton>` on `OrderTrackingPage` + `OrderSuccessPage` (amber window card with live countdown, 3-step dialog: reason radio → refund summary with amount/method/ETA → success state). Cancelled order renders dedicated `tracking-cancelled` banner. `<PriceAdjustmentBanner>` reveals old→new total + admin reason on tracking when an admin modifies.
- [x] Admin UI:
  - `<AdminModifyOrderDrawer>` (Sheet) on `/admin/orders` "Manage" button — items add/remove/qty, manual discount + reason, fulfillment switcher (delivery/pickup/dine_in), address/table inputs, kitchen notes, modification reason (visible to customer), audit trail, Cancel-&-refund CTA.
  - `/admin/cancellations` (sidebar "Cancellations", XCircle icon) — policy card (5 toggles + window input), reason-breakdown bars, recent-cancellations table with refund badges.
- [x] Tested: 25/25 backend pytest pass (`test_order_modification.py`). Testing agent validated full customer + admin flows end-to-end with zero bugs found; refund correctly MOCKED (`db.refunds.mocked=true`, `payment_status=refunded`, no Stripe call) per user choice (option c).

### Phase 33 - Full E2E Regression Sweep (Feb 2026)
- [x] Ran complete backend pytest suite across all 32 phases: **454/460 pass (98.7%)** after test-hygiene cleanup. All 6 remaining failures are outdated test expectations / stale seed data, not product bugs — see /app/test_reports/iteration_32.json for RCA.
- [x] Full frontend E2E via testing_agent_v3_fork: all 24 admin sidebar links load cleanly, public storefront healthy, Phase 32 SEO JSON-LD injection verified on /, /menu, /product/{id} with real-id canonicals.
- [x] Production hardening: updated `routes/seo.py::_resolve_base_url` to ignore stale `example.com`/`localhost` site_url values and fall back to the request host — prevents test fixtures from ever leaking into public canonical/og:url tags. DB stale `site_url` and home-page SEO title cleared.
- [x] Extended SEO pytest `cleanup` fixture to reset `site_url` + page-level overrides after every run so future test sessions never pollute production DB state.
- [x] Modernised `/app/backend/tests/test_api.py`: removed skeleton-era 200-on-404 assertions and replaced admin-endpoint tests with proper 401 auth-guard checks.
- [x] Known remaining pytest noise (non-blocking, test-only):
  - `test_menu_catalog::test_get_sold_out_item / test_get_seasonal_item` — couple to admin-toggled items; fixtures should create their own instead.
  - `test_store_hours::test_pause_*` — expect body-less POST but `/api/admin/store/pause` now mandates `{paused: bool}` payload.
  - `test_checkout_orders::test_welcome5_promo_min_subtotal / test_payment_status_for_created_order` — stale test-data isolation.
  Flagged in PRD backlog; do not affect production flow.

### Phase 32 - SEO Optimization & Structured Data (Feb 2026)
- [x] Backend `routes/seo.py` (new): global SEO settings (`GET/PATCH /api/admin/seo/settings`), per-page SEO CRUD (`GET/PATCH /api/admin/seo/pages/{page_key}`), public per-page meta + JSON-LD (`GET /api/seo/page/{key}` with `product_id` / `category_slug` enrichment and templated-path substitution for canonical URLs).
- [x] URL Redirects CRUD (`/api/admin/seo/redirects`) with 301/302 support, duplicate `from_path` rejection (409), self-reference rejection (400), and public lookup `GET /api/seo/redirect-check?path=` that increments `hits` + `last_hit_at`.
- [x] Dynamic `GET /api/seo/sitemap.xml` — static indexed pages + auto-included categories + menu items with configurable changefreq/priority. Per-page `noindex` respected.
- [x] `GET /api/seo/robots.txt` — admin-editable disallow paths, crawl-delay, extra lines; appends Sitemap URL.
- [x] Structured Data builder renders Organization, Restaurant, LocalBusiness, WebSite (with SearchAction), Menu (with MenuSection + MenuItem per category), MenuItem (context-enriched for product pages), and BreadcrumbList (home/menu/item path).
- [x] SEO Health audit `GET /api/admin/seo/health`: score 0-100, summary pass/warn/fail, checks across global config, per-page title length (20–65), description length (70–170), OG image, duplicate titles/descriptions, noindex on public pages, redirect chains/loops, sitemap configuration.
- [x] Admin `/admin/seo` (sidebar "SEO", Search icon) with 6 tabs: **Per-Page** (page list + editor with char counters + live Google SERP preview + Facebook/Twitter OG card preview), **Structured Data** (schema type toggle grid + live JSON-LD preview + Copy JSON + Google Rich Results test link), **Global** (site URL, title suffix, defaults, verification tags, organization, sitemap), **Redirects** (from→to table + create/delete + 301/302 select + hit counter), **Sitemap & Robots** (regenerate + URL table + robots preview + download), **Health** (score badge + grouped pass/warn/fail checks + re-run).
- [x] Public frontend injection via new `useSeo(pageKey, params?)` hook in `/app/frontend/src/hooks/useSeo.js`: sets `document.title`, meta description/keywords/robots, og:title/description/image/url/type, twitter:card/title/description/image, verification tags, canonical link, and appends `<script type=application/ld+json>` blocks. Hook wired into HomePage, MenuPage, ProductDetailPage, CategoryLandingPage.
- [x] Tested: 19/19 backend pytest pass (`test_seo.py`). Full scripted admin UI + public meta injection validated by testing agent. Bug found & fixed: canonical URLs for product/category pages leaked literal `{id}`/`{slug}` templates — now substituted with real ids + guarded by regression test.
- [x] Known design: sitemap.xml & robots.txt are served under `/api/seo/*` because the Kubernetes ingress routes non-`/api` traffic to the frontend; the admin UI clearly surfaces the absolute public URLs.

### Phase 31 - Daily Summary & End-of-Day Report (Feb 2026)
- [x] Backend `routes/daily_summary.py` (new): `GET /api/admin/daily-summary?date=` (live compute), `POST /generate` (archives a snapshot + optional MOCKED email), `GET /history` with `date_from`/`date_to` filter, `GET/DELETE /{sid}`, delivery-settings (`/delivery-settings`) GET/PATCH with {enabled, recipients, send_at HH:MM, format pdf|html|csv}. Router ordering fixed so `/delivery-settings` isn't captured by `/{sid}`.
- [x] Summary payload: orders, revenue, AOV, tips, fulfillment mix, top 5 items, refunds, cancellations, customers (new/returning/ratio), compare_last_week (same-day WoW deltas) + compare_last_month (MTD vs prev-month MTD).
- [x] Frontend `/admin/daily-summary` (sidebar "Daily Summary", FileText icon): date picker + Today / Refresh / Print / Generate snapshot / Generate & email action bar, full summary content with KPIs & delta pills, fulfillment-mix card, customers new/returning bar, top-5 items, refunds/cancellations, WoW + MoM comparison cards, report-history list (search, view, JSON download, delete) + delivery-settings card (recipients chips, time, format, enable/disable, MOCKED badge).
- [x] Print-friendly mode: `?print=1` renders the same page with sidebar/action bar hidden (via `@media print` + `data-print-hide`) and auto-triggers `window.print()` after 500ms.
- [x] Email delivery is MOCKED (delivery_log persists mocked:true, logger records send).
- [x] Tested: 17/17 backend pytest pass, full scripted frontend flow validated including generate → history row → print mode → delivery-settings add/save. 0 bugs.

### Phase 30 - Tax & Service Charge Configuration (Feb 2026)
- [x] Backend `routes/fees.py` (new): multi-jurisdiction **Region CRUD** (`/admin/fees/regions`) with default region auto-seeded; each region owns tax (name/rate/inclusive + category + item overrides), service_charge, packaging_fee, eco_fee, delivery_rules (flat/distance/tiered with min_order).
- [x] Public `POST /api/fees/quote` — line-by-line pricing engine with per-item tax resolution, inclusive-tax extraction, multi-rate breakdown, service/packaging/eco, tiered-by-subtotal / distance-based / flat delivery, `delivery_blocked` when below min_order; accepts unsaved `region_override` for the admin live preview.
- [x] Public `GET /api/fees/default-region` exposes tax name + inclusive flag so storefronts can render correct receipt copy ("Sales Tax" vs "VAT" vs "GST").
- [x] Admin CSV `GET /api/admin/fees/tax-report?start&end&region_id` with totals + per-category rows (taxable_base, effective rate, tax collected); correctly handles inclusive pricing by reporting net base.
- [x] Admin `/admin/fees` page (sidebar "Tax & Charges", Receipt icon): region switcher with star-marked default, config editor across Region identity / Tax (with category + item override tables) / Service charge / Delivery rules (flat/distance/tiered editor) / Packaging / Eco / Tax report download. A sticky **live Checkout Preview** column on the right renders sample cart with instant tax-rate-by-rate breakdown before the admin hits Save.
- [x] Bug fixes in second iteration: `_deep_merge` gained `replace_keys` param so PATCH `{tax:{category_overrides:{}}}` clears the dict; `copy.deepcopy(DEFAULT_REGION)` prevents cross-region mutation; live preview now sends `region_override` so the right-hand column reflects unsaved edits.
- [x] Tested: 29/29 pytest pass (test_fees_config.py), scripted frontend flows validated (live preview updates within ~1s of edit). 0 bugs.

### Phase 29 - Operating Hours & Holiday Management (Feb 2026)
- [x] Backend `routes/store.py` upgraded: `/store/status` now returns `pause_reason`, `pause_until`, `special_today`, `accept_advance_orders`, `max_days_ahead` alongside the existing service availability map.
- [x] `/admin/store/pause` now takes `{paused?, reason?, estimated_reopen?}` — stores customer-visible reason + ETA when paused, clears them on resume.
- [x] Special / extended hours CRUD (`/admin/store/special-hours`): single-doc-per-date upsert; overrides the weekly schedule and is surfaced via `/store/status.special_today`.
- [x] Advance-order config (`GET/PATCH /admin/store/advance-orders`) clamped to 1–30 days.
- [x] Holidays: `HolidayCreate.message` added and passed through to the customer overlay.
- [x] `/admin/store/overview` returns next 7 days with effective per-service hours, holiday/special badges, and **delivery-vs-kitchen conflict warnings**.
- [x] Admin `/admin/hours` fully rewritten: pause card + emergency **Pause dialog** (reason + reopen date/time), weekly 3-service grid (per-day per-service time pickers + toggles + "apply to all days"), Next-7-days overview table with conflict chips, holidays + special-hours sections with inline create/list/delete, advance-orders card.
- [x] `ClosedOverlay` surfaces `holiday-message`, `pause-reason`, `pause-until`, and hides the `Order for Later` CTA when `accept_advance_orders=false`.
- [x] Tested: 18/18 pytest pass, full scripted frontend flow validated, conflict detection verified on real overnight-delivery config. 0 bugs.

### Phase 28 - Store Profile & Branding Configuration (Feb 2026)
- [x] Emergent Object Storage integration (`routes/uploads.py`): admin-auth'd POST `/api/admin/uploads` (multipart, 6 MB cap, image MIME whitelist), public GET `/api/files/{id}` proxy with correct Content-Type + cache-control, GET list + soft-delete. Storage key initialized from `EMERGENT_LLM_KEY`.
- [x] Storefront extended: `cuisine_type`, `banner_image_url`, `social.whatsapp` — deep-merge preserved.
- [x] Admin Storefront page: drag-drop `FileUploader`s for logo, favicon, hero banner, hero image, about photo; cuisine-type + WhatsApp inputs.
- [x] New admin page `/admin/store-profile` (sidebar "Store Profile", MapPin icon) with:
  - **Completion Card** — live % (checklist over 22 fields), direct links to incomplete sections (auto-refresh every 30s)
  - **Locations Card** — CRUD with primary-location promotion, inheritance reminder
  - **Google Business Profile Card** — connect / sync / disconnect cycle (MOCKED OAuth + Google API; persists `last_synced_at`, `last_sync_status`, `synced_fields`)
  - **Branding Preview Card** — tabs for printed-receipt and confirmation-email previews using live logo, primary color, and contact fields
- [x] Tested: 23/23 pytest + Playwright E2E passing; actual PNG upload round-trip to Emergent Object Storage verified; storefront deep-merge preserved; GBP cycle verified. 0 bugs.

### Phase 27 - Sales Dashboard & Reports (Feb 2026)
- [x] Backend `analytics.py` extended: `today` block (orders/revenue/aov + fulfillment_mix), `previous_period` (+ revenue_delta_pct/order_delta_pct/aov_delta_pct), `heatmap` (7×24 day-of-week × hour matrix), `top_items` enriched with `image`, `item_id`, `category`, `trend_pct`, `direction`; `revenue_over_time` buckets now carry `previous` series for overlay.
- [x] Backend `routes/reports.py` (new): GET `/api/admin/reports/export?type=orders|revenue|items&start&end` (CSV streaming, default last 30 days); full schedule CRUD (`/api/admin/reports/schedules`) + mocked `/send-now` that computes rows and updates `last_sent_at`, `last_status`, `last_row_count`, `next_send_at`.
- [x] Frontend: `TodayStrip` (gradient card pinned at top with today orders/revenue/AOV + delivery/pickup/dine-in counts), KPI card delta pills, revenue-trend chart with current+previous overlay and legend, `PeakHoursHeatmap` (7×24 color-graded cells + scale legend), enriched top-items list (image + rank + trend pill + category chip), `CategoryDonut` (SVG donut + legend), Export CSV button in header → `ExportDialog` with type cards + date-range pickers, `ReportScheduler` inline section (create/edit/pause/send-now/delete).
- [x] Email delivery for scheduled reports is MOCKED (logs only, persists delivery state).
- [x] Tested: 13/13 backend pytest pass, full scripted frontend flow validated — TodayStrip, deltas, heatmap (168 cells with data-value), top-item cards, donut + legend, CSV download via dialog, schedule lifecycle (create → send-now → toggle → delete). 0 bugs.

### Phase 26 - Guest Checkout + Account Claim (Feb 2026)
- [x] Backend `/app/backend/routes/guest_conversion.py`: POST `/api/auth/check-email` (returns {exists, auth_provider}) + POST `/api/auth/claim-orders` (validates order_id & email match, rejects if account exists (409), creates user, links every guest order on the email to the new user_id, accrues loyalty pts = Σ floor(order.total), sets auth cookies).
- [x] Frontend `GuestCheckoutChoice` card: top of `/checkout`, two options (Sign in / Continue as guest) with benefits list; dismiss persists in localStorage `guest_choice_dismissed_v1`.
- [x] `ReturningGuestHint`: debounced (450ms) email-exists check under summary-step email input; amber banner with deep-link `/login?redirect=/checkout&email=<typed>`.
- [x] `LoginPage` now honours `?redirect=` and `?email=` query params.
- [x] `PostPurchaseAccountCreate` card on `OrderSuccessPage` for guest orders only: email pre-filled (disabled) + single password + submit → transitions to `account-created-state` showing claimed order count + loyalty points; calls `refreshAuth()`.
- [x] Admin guest badges: `admin-guest-badge-{id}` on `/admin/orders` list, `guest-badge-{id}` on Live Queue OrderCard, `incoming-guest-badge-{id}` on dashboard incoming panel.
- [x] Tested: 6/6 backend pytest pass (`test_guest_conversion.py`), scripted frontend flows validated on /checkout, /login, /admin/orders, /admin dashboard, /admin/queue. 0 bugs.

### Phase 25 - Menu/Catalog Browsing & Search (Feb 2026)
- [x] Backend `/app/backend/routes/catalog_settings.py`: GET `/api/catalog/settings` (public) + GET/PATCH `/api/admin/catalog/settings` for visible_dietary_tags, default_sort, quick_view_enabled, price_min/max, sticky_category_bar, show_in_stock_toggle. Sort + dietary tag inputs are validated against whitelists (400 on invalid sort).
- [x] Backend `/api/search/menu` extended: multi `dietary[]` ($all), `min_price`/`max_price`, `in_stock_only`, `sort` (popularity|price_asc|price_desc|newest|name_asc), limit cap 60.
- [x] `MenuItem` model + seed backfill: every seed item 001–010 carries a realistic `dietary_tags` array (vegan / vegetarian / gluten_free / dairy_free / halal / nut_free / spicy). Idempotent.
- [x] Frontend `/menu` rewritten: sticky toolbar (search input + sort select + filters button), autocomplete dropdown (images + price), sticky category pills row (scroll-to-section), filter drawer (dietary chips, price-range slider, in-stock switch), active-filter chip row with clear-all, sort options, no-results state with friendly copy + suggestion chips, grouped result sections with ref-based smooth scroll.
- [x] QuickViewModal (`/app/frontend/src/components/menu/QuickViewModal.js`): image, variants, modifiers, qty, add-to-cart, 'Full details' link. Admin can disable via quick_view_enabled → cards revert to direct navigation.
- [x] Admin `/admin/catalog-settings` page (sidebar "Menu & Search", Filter icon): dietary toggle grid, default-sort select, price bounds inputs, quick-view / sticky-bar / in-stock switches. Dirty-state save, discard, preview-menu link.
- [x] Tested: 20/20 new backend pytests pass; full scripted frontend flow validated — sticky bar scroll, autocomplete, multi-dietary filter, price slider, sort, quick-view add-to-cart, quick-view disabled path, admin save propagation. 0 functional bugs. A11y: added DialogDescription to QuickViewModal post-test.

### Phase 24 - Branded Storefront & Customization Panel (Feb 2026)
- [x] Backend `/app/backend/routes/storefront.py`: GET `/api/storefront/settings` (public), GET/PATCH `/api/admin/storefront/settings` (admin, deep-merge), GET `/api/storefront/social-proof` (orders_today count + seeded reviews + avg rating).
- [x] Public HomePage now fully dynamic: hero eyebrow/title/subtitle/CTA/image from settings; AboutSection, FeaturedCategories, SocialProofSection, BrandFooter appended.
- [x] SEO live: title, meta description, og:title/description/image, favicon — all driven by settings via `applyStorefrontMeta`.
- [x] Live brand theming (Option B): Tailwind `brand.primary/primary-hover/orange/orange-hover/accent` now read CSS vars; `useStorefront` injects `--brand-primary`, `--brand-orange`, `--brand-accent` on `document.documentElement` on load + on save. `shade()` auto-generates the hover variant. useStorefront mounted at AppRouter level → vars active on every page.
- [x] Admin `/admin/storefront` page: Brand identity (name/tagline/logo/favicon), Brand colors (color-picker + hex, live preview row), Hero (eyebrow/title/subtitle/CTA/image), About (heading/body/mission/sourcing/image), Contact & social (email/phone/address + Instagram/Twitter/Facebook/TikTok), SEO (title/description/og image). Dirty-state detection, Discard, Preview-site, Save & publish (disabled when clean).
- [x] Sidebar entry "Storefront" (Palette icon).
- [x] Tested: 11/11 backend pytest pass (new `/app/backend/tests/test_storefront.py`), 100% scripted frontend flows pass — auth guards, deep-merge partial patch, public reflection, live CSS var propagation, SEO title, discard, restore to defaults. 0 bugs.

### Phase 23 - Quick 86 / Sold-Out Toggle (Feb 2026)
- [x] Backend: POST `/api/admin/86/items/{id}/toggle` (flip or explicit status), POST `/api/admin/86/batch` (by item_ids OR category), GET `/api/admin/86/log` (history), GET/PATCH `/api/admin/86/settings` (auto_restore_on_open). Every state change logged with actor + source.
- [x] Auto-restore: hook on `/api/store/status` — when store reopens for a fresh date, all sold_out items flip to in_stock and are logged (source 'auto_restore_on_open'). Runs at most once per day.
- [x] Frontend `/admin/86`: search, category filter, per-item toggle/restore, multi-select batch 86/restore, quick "86 all category" and "Restore all category" buttons, auto-restore switch, full history log table.
- [x] Live Queue OrderCards: hover-revealed `86` micro-button next to every item line (visible by default on touch screens); confirm dialog + toast.
- [x] Sidebar entry "86 / Sold-Out" (Ban icon).
- [x] Tested: 20/20 new pytest pass; 11/11 Playwright steps pass; zero bugs found.

### Phase 22 - Prep Time & Throttling (Feb 2026)
- [x] Backend: `POST /api/store/eta` (public) — computes ETA from cart categories/items + prep-time map + queue depth. Returns `{asap_available, eta_minutes, eta_label, capacity_state, active_count, max_concurrent_orders, paused, next_available_slot}`.
- [x] Backend: `GET/PATCH /api/admin/throttle/settings` (max_concurrent_orders, auto_pause_threshold, slot_granularity_minutes, base_buffer_minutes), `GET /api/admin/throttle/status` (live utilization), `GET/PUT /api/admin/prep-times` (reuses KDS target_prep_minutes_by_category for DRY).
- [x] Auto-pause hook: `maybe_auto_pause()` fires on payment confirm; when active ≥ threshold, flips store pause_ordering. Explicit admin resume required.
- [x] Order creation now uses ETA-based `estimated_minutes` (replaces hardcoded 30/20 min).
- [x] Frontend: `/admin/throttle` page — live load gauge, state badge (Normal/Busy/At Capacity/Paused), capacity config inputs, auto-pause toggle, prep times table with add/edit/remove, manual pause/resume button.
- [x] Frontend: `/admin/queue` — throttle-banner at top, color-coded by state.
- [x] Frontend: `/checkout` summary card shows live `Ready in ~X min` ETA; when at capacity, shows `Next available slot: HH:MM` and grey-overrides ASAP.
- [x] Sidebar: "Prep & Throttle" (Gauge icon).
- [x] Tested: 18/18 new pytest pass; testing agent detected & fixed 2 frontend self-inflicted bugs (missing state declaration + orphan JSX); all testids verified.

### Phase 21 - Live Queue + Audio Alerts (Feb 2026)
- [x] Backend: `GET /api/admin/queue/live` (active orders + today summary: orders_today, revenue_today, pending/in-progress counts, avg_prep_minutes); `POST /api/admin/orders-batch/accept` (batch accept with per-order auto-queue hook). Path intentionally `orders-batch` to avoid parametric collision with `/admin/orders/{id}/accept`.
- [x] Frontend: `/admin/queue` full-width dashboard with 5 color-coded lanes (Incoming/Preparing/Ready/En-route/Completed), order cards with one-tap Accept/Reject/Advance/Reprint actions, highlighted special instructions, "time since placed" ticker.
- [x] Reject flow: mandatory reason dropdown (Out of stock / Kitchen closed / Too busy / Other+note) → `/api/admin/orders/:id/reject`.
- [x] Audio alerts: 4 Web-Audio-API synthesized chimes (bell, soft, ding, double — zero network cost), volume slider, mute toggle, escalation chime (triple-tap) after configurable 30/60/120s on unacknowledged incoming orders. Settings persisted in `localStorage` key `culinary_queue_settings_v1`.
- [x] Desktop notifications: permission request + sample; fires only for new incoming orders.
- [x] Batch accept UI: select multiple incoming orders, floating batch bar, one-click accept-all.
- [x] Summary bar pinned to top: orders today, revenue, pending, in progress, avg prep.
- [x] Filters: delivery/pickup/dine-in/all; Sort: oldest/newest/highest value.
- [x] Sidebar entry "Live Queue" (Zap icon); `/admin` dashboard now has a prominent gradient CTA to the queue.
- [x] Tested: 11/11 new pytest pass, 32/32 regression preserved; full frontend testid & interaction audit passed with 0 page errors.

### Phase 20 - Refactor + Search + Analytics (Feb 2026)
- [x] **Refactor**: `server.py` (2,197 lines) → `server.py` (~70 lines) + `core.py` (app, api_router, db, auth helpers) + `models.py` (all Pydantic) + `seed.py` (startup seeding) + `routes/{auth,catalog,store,orders,payments,admin,kds,printers,search,analytics}.py`. Zero endpoint contract changes; 32/32 backend regression + 22/22 printer tests pass.
- [x] **Search**: Public `GET /api/search/menu?q=&category=&tag=` + admin `GET /api/admin/search/orders?q=` + admin `GET /api/admin/search/catalog?q=`. Regex-escaped user input. SearchBar in Navbar with live dropdown + `/search` results page with category pills + live search input in `/admin/orders`.
- [x] **Analytics**: `GET /api/admin/analytics/summary?range={day|week|month|quarter|year}` returning total_revenue, order_count, AOV, customers{unique,new,returning}, fulfillment_mix, top_items, top_categories, busy_hours[24], revenue_over_time buckets, top_customers. `/admin/analytics` page with KPI cards, revenue chart, busy-hours chart, fulfillment mix, top items/categories/customers, range toggle. Sidebar entry added.

### Phase 18 - Admin Accept Order Fix (Feb 2026)
- [x] Root cause: payment-confirm set order `status="preparing"` immediately, and `/admin/orders/new` included `preparing` in its filter. Clicking Accept re-set to `preparing` (no-op) — incoming orders reappeared on reload.
- [x] Paid orders now enter as `status="pending"` (awaiting acceptance); `/admin/orders/new` filters `status=pending` only; KDS filters `preparing|ready`.

### Phase 19 - Thermal Ticket Printing (Feb 2026)
- [x] Backend: printers CRUD, test print, print-settings (auto_trigger: on_placement|on_acceptance|off, auto_receipt), print-jobs history, POST /admin/orders/:id/print (kitchen|receipt), public GET /orders/:id/receipt
- [x] Auto-queue hook fires on payment confirm (on_placement) and admin accept (on_acceptance). Uses KDS station_routing to map item categories → station → online printer; falls back to online kitchen-station printers.
- [x] Frontend: /admin/printers (list/add/edit/delete/toggle online/test print), /admin/print-settings (trigger + auto receipt + routing summary), /admin/print-jobs (history + open ticket), /admin/orders (real orders list with reprint kitchen/receipt buttons)
- [x] Ticket components (80mm monospace): KitchenTicket.jsx, CustomerReceipt.jsx — rendered by /admin/ticket/:order_id (admin, either type) and /receipt/:order_id (public, customer). ?auto=1 auto-opens the browser print dialog.
- [x] Print receipt buttons on OrderSuccessPage, OrderTrackingPage, CustomerOrdersPage
- [x] Sidebar: Printers / Print Settings / Print History added to AdminLayout
- [x] Tested: 22/22 backend pytests (/app/backend/tests/test_printers.py), all frontend data-testids verified via testing agent
- [x] Mocked: thermal hardware is simulated via browser window.print(); status toggle is manual only (user choice)

### Phase 17 - Checkout 422 Fix (Feb 2026)
- [x] Root cause: `HomePage.js` "Currently Craving" used hardcoded numeric ids (1–4) not present in backend catalog — backend `OrderLineIn.item_id: str` Pydantic validation rejected them → 422
- [x] Fix 1 (Frontend/HomePage.js): Fetch featured items from `/api/menu/items` so card IDs are real `item-XXX` strings
- [x] Fix 2 (CartContext): `loadCart()` filters out stale entries missing a valid string `id` (protects legacy carts)
- [x] Added `RequestValidationError` handler in backend that logs the failing body+errors for future debugging
- [x] Verified end-to-end via Playwright: checkout redirected to Stripe with 200 OK

### Phase 16 - Kitchen Display System
- [x] Full-screen dark KDS board at `/kds` (hides store-closed overlay) with 5s polling
- [x] Per-station view at `/kds/:station` — filters items by `station_routing` config
- [x] Order cards: order number, fulfillment badge, customer/table, live MM:SS timer from `accepted_at`, items with modifiers + special instructions
- [x] Color-coded urgency: green (<80% of target), yellow (80–100%), red (>100%, animate-pulse)
- [x] Tap-to-bump items: pending → started → ready (PATCH /api/admin/kds/orders/:id/items/:idx)
- [x] Bump whole order button: POST /api/admin/kds/orders/:id/bump (advances to ready or out_for_delivery)
- [x] Audio chime (Web Audio API) on new arrivals + persisted mute toggle
- [x] Column layout switcher (2/3/4) persisted via settings default
- [x] New `/admin/kds-settings` page: audio toggle, default columns, target prep minutes per category (add/rename/delete), station routing (add/remove stations, toggle category chips)
- [x] Default categories seeded: mains/entrees/appetizers/starters/salads/sides/desserts/pastries/drinks/cocktails
- [x] Default stations seeded: grill/bar/dessert/cold
- [x] Sidebar nav entry 'Kitchen (KDS)' added
- [x] Tested via testing_agent_v3_fork iteration_16 — Backend 100% (23/23), Frontend 100%

### Phase 15 - Order History & Reorder
- [x] New `/orders` customer order history page: logged-in user's orders (user_id match) + guest email lookup form
- [x] Order rows: order number, date, items summary, total, fulfillment badge, status badge, favorite star, reorder button, detail link
- [x] Favorites: `PATCH /api/orders/:id/favorite` (owner/admin scoped), starred orders pinned in a separate section above "All orders"
- [x] Client-side Reorder dialog: cross-checks current `/api/menu/items` availability, lists unavailable items with reasons (sold out, seasonal, no longer on menu, variant unavailable), allows proceeding with available items only
- [x] Empty state illustration + "Browse menu" CTA
- [x] OrderTrackingPage: added "Reorder these items" CTA that deep-links to `/orders?reorder=<id>` and auto-opens dialog
- [x] Navbar dropdown + Bottom nav Orders links wired
- [x] Tested via testing_agent_v3_fork iteration_15 — Backend 100% (8/8), Frontend 100%. Testing agent fixed 2 user_id extraction bugs and 1 menu-status comparison bug.

### Phase 14 - Order Placement & Confirmation
- [x] Public real-time tracking page `/orders/track/:order_id` with stepper (Order Received → Preparing → Ready/Out for Delivery → Delivered/Completed), live countdown timer, 10s polling
- [x] Per-fulfillment stepper variants (delivery/pickup/dine_in)
- [x] Rejection banner with reason when status=rejected
- [x] OrderSuccessPage: collapsible styled email receipt preview (From/To/Subject + order meta + itemized + CTA + footer) — MOCKED (visual only, not sent)
- [x] OrderSuccessPage: enhanced failed state with reason label + retry + back-to-menu
- [x] Admin New-Orders panel on dashboard: 6s polling, Web Audio generated chime on new arrivals, persisted mute toggle, pulsing red count badge, Accept/Reject (with reason prompt) / View actions
- [x] Backend: GET /api/admin/orders/new (since filter), POST /accept, POST /reject, POST /advance (cycles status pipeline per fulfillment)
- [x] Public GET /api/orders/:id (order_id acts as auth token for tracking link)
- [x] Tested via testing_agent_v3_fork iteration_14 — Backend 100%, Frontend 100%

### Phase 13 - Promo Code / Coupon Redemption
- [x] Promo codes moved from hardcoded dict → `promo_codes` MongoDB collection
- [x] Seeded on startup: SAVE10 (10%), WELCOME5 ($5 min $20, first-order-only), FREESHIP (free delivery min $25), EXPIRED10 (demo expired)
- [x] Types supported: `percent`, `fixed`, `free_delivery` (BOGO deferred per user choice)
- [x] Backend `/api/orders/validate-promo` queries DB and enforces active, not-expired, usage_limit, min_subtotal, first_order_only, fulfillment compatibility (free_delivery requires delivery)
- [x] Backend `_compute_order_totals` is async + DB-aware; used by POST /api/orders
- [x] `usage_count` increments idempotently when an order flips to paid
- [x] Admin CRUD: GET/POST/PUT/DELETE `/api/admin/coupons` + `PATCH /toggle`
- [x] Cart sidebar: compact promo input with loading + clear (X), error text, green applied panel, discount preview line
- [x] Checkout summary: full promo panel with loading spinner, clear button, inline error, green applied state
- [x] Free-delivery visually shown as crossed-out delivery fee + green FREE badge in order summary
- [x] Shared promo state in CartContext — codes entered in cart carry over to checkout
- [x] Admin `/admin/coupons` list page with toggle, edit, delete + 'First-order only' and expired indicators
- [x] Admin coupon form (create/edit) with type selector, value hidden for free_delivery, validation, expiry + usage limit
- [x] Tested via testing_agent_v3_fork iteration_13 — Backend 100% (18/18), Frontend 100%

### Phase 12 - Global Payment Gateway
- [x] Payment Method Selector with 4 active-state cards: Credit/Debit Card, Apple Pay, Google Pay, PayPal (all logos custom-rendered)
- [x] On-page card input form with real-time brand detection (Visa/Mastercard/Amex/Discover/Diners/JCB)
- [x] Luhn validation, MM/YY expiry parsing with expired-date detection, CVV length by brand (3/4)
- [x] Pay CTA gated on: terms checkbox + (saved card OR non-card method OR fully valid card form)
- [x] Saved Payment Methods (logged-in users): MOCKED — brand+last4+expiry stored in MongoDB, auto-persisted on successful paid order, delete + add-new controls
- [x] Non-card method info panel explaining Stripe redirect
- [x] Actual charge remains via real Stripe Checkout (hosted page)
- [x] Backend: GET/POST/DELETE /api/payment-methods with auth, duplicate detection, last4 sanitization
- [x] OrderSuccessPage animated checkmark (scale-in keyframe)
- [x] Tested via testing_agent_v3_fork iteration_12 — Backend 100% (8/8), Frontend 100%
- MOCKED: PayPal/Apple Pay/Google Pay visuals all route through Stripe Checkout; saved cards are mock brand+last4 only (never real card data)

### Phase 11 - Checkout Flow
- [x] 5-step wizard: Fulfillment → Address → Time → Summary → Payment (Address auto-skipped for Pickup/Dine-In)
- [x] Step 1 Fulfillment: Delivery/Pickup/Dine-In cards; Pickup shows store info; Dine-In requires table number
- [x] Step 2 Address: Nominatim (OpenStreetMap) autocomplete + Leaflet map preview; saved addresses for logged-in users
- [x] Step 3 Time: ASAP + 9 hardcoded slots with 2 sold-out greyed chips
- [x] Step 4 Summary: itemized + contact (guest email required) + promo code (SAVE10/WELCOME5/FREESHIP) + tip (10/15/20/custom)
- [x] Step 5 Payment: Stripe-powered info card (Card/Apple Pay/Google Pay) with terms checkbox; redirects to Stripe Checkout
- [x] Order Confirmation (/order/success): polls /api/payments/status, shows order number, ETA, itemized summary, Track Order CTA; retry flow for unpaid sessions
- [x] Guest checkout: works without login, email captured for receipt
- [x] Backend: db.orders + db.payment_transactions; POST /api/orders, GET /api/orders/:id, GET /api/orders (user/email scoped), GET /api/payments/status/:id, POST /api/webhook/stripe, POST /api/orders/validate-promo
- [x] Backend computes prices authoritatively from DB (security); tax 8.75%, delivery $4.99
- [x] Tested via testing_agent_v3_fork iteration_11 — Frontend 100%, Backend 94.7%

### Phase 10 - Shopping Cart with Real-Time Updates
- [x] Right-side slide-in sidebar using shadcn `Sheet` (replaces bottom Drawer)
- [x] Auto-opens on add-to-cart; persists in localStorage (`culinary_cart`)
- [x] Empty state with "Browse Menu" CTA that navigates to /menu
- [x] Line items show image, name, variant, modifiers, instructions, qty stepper, trash
- [x] Real-time line totals + subtotal (reactive via CartContext)
- [x] Minimum order banner ($15) with progress bar; disables Checkout + shows "$X more to checkout"
- [x] Remove item triggers sonner undo toast (4s) that restores the item on click
- [x] Global `<Toaster />` mounted in App.js (bottom-right, richColors)
- [x] Tested by testing_agent_v3_fork iteration_10 — 100% pass

### Phase 9 - Operating Hours & Availability
- [x] Navbar: Green dot "Open Now" + closing time, or Red pulsing dot "Closed" + next opening
- [x] Closed Overlay: Full-screen on homepage showing hours card, "Browse Menu" + "Order for Later" CTAs
- [x] Overlay hidden on /menu, /product, /admin, /login pages (users can still browse)
- [x] Holiday Banner: Red banner across top with reason + date
- [x] Pause Banner: Red banner when ordering temporarily paused
- [x] Admin Hours: Day-by-day config per service (Delivery/Pickup/Dine-In), Save button
- [x] Admin Holidays: Date picker, reason, upcoming/past lists, create/delete
- [x] Pause Ordering: One-tap emergency button to stop all orders
- [x] Default hours seeded: Mon-Sat 10AM-10PM, Sun 11AM-10PM

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Backlog
### P1: Subscriptions (meal plan, weekly/monthly recurrence, billing hooks)
### P1: Loyalty program (points, tiers, redeemable rewards) — user previously deferred; revisit
### P1: Performance & CDN admin screens — user requested skip in Phase 33 E2E session; revisit on demand
### P2: Real webhook signing (Stripe), multi-location support, SMS notifications
### P3 (test hygiene): `test_menu_catalog` + `test_store_hours` + `test_checkout_orders` — refactor to use self-managed fixtures instead of shared seed state
