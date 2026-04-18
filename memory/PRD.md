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
10. Shopping Cart with Real-Time Updates (current)

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
### P0: Order & Checkout Flow (address, pickup/delivery, payment method), Stripe payment
### P1: Order tracking page, Kitchen display, Analytics
### P2: Loyalty, subscriptions, search
