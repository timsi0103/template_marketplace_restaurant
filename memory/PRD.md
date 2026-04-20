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
16. Kitchen Display System (KDS) (current)

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
### P0: Wire Order Tracking page to GET /api/orders/:id (show live status, prep progress)
### P1: Kitchen display queue (consume /api/kitchen/orders), admin orders table, Analytics
### P2: Loyalty, subscriptions, search, real webhook signing
