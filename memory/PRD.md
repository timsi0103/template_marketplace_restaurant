# The Culinary Editorial - F&B E-Commerce Platform PRD

## Original Problem Statement
Create a food & beverage e-commerce website template serving restaurant owners, food trucks, D2C food brands, bakeries.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI, relative API paths (/api/...)
- **Backend**: FastAPI + MongoDB (Motor async), JWT + Emergent Google OAuth
- **Design**: Cormorant Garamond + Manrope, #F8F5F0/#6E1C1E/#E55A3D

## What's Been Implemented

### Phase 1 - Skeleton Template
- [x] 8 page skeletons, Navigation, Footer

### Phase 2 - Authentication & Identity
- [x] JWT email/password, Google OAuth, Guest sessions, admin seeding

### Phase 3 - Mobile-First Responsive Design
- [x] Bottom nav, cart drawer, horizontal scroll, sticky bars, touch targets

### Phase 4 - Product/Menu Item Catalog
- [x] Full CRUD, gallery carousel, availability badges, admin catalog table

### Phase 5 - Categories & Subcategories (Current)
- [x] **Storefront Category Navigation**: Image-based category bar (All, Starters, Mains, Drinks, Desserts) with active/selected state, subcategory dropdown on click, secondary pill bar
- [x] **Category Landing Page** (/menu/:slug): Hero image, description, subcategory filter bar, filtered item grid, back to all categories link
- [x] **Admin Category Management** (/admin/categories): Table with drag-and-drop reorder, category images, slug, description, subcategory count, visibility toggle, edit/delete actions
- [x] **Admin Add/Edit Category Form**: Name, slug, description, image URL, parent category selector (for subcategories), visibility toggle
- [x] **Backend**: Full CRUD + reorder endpoint, 4 top-level + 12 subcategories seeded

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Prioritized Backlog
### P0
- Order placement flow (cart → order creation)
- Payment integration (Stripe)
### P1
- Order tracking real-time updates
- Kitchen display with order management
- Admin analytics with charts
### P2
- Loyalty points, subscriptions, search, notifications
