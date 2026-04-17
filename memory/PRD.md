# The Culinary Editorial - F&B E-Commerce Platform PRD

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI, relative API paths (/api/...)
- **Backend**: FastAPI + MongoDB (Motor async), JWT + Emergent Google OAuth
- **Design**: Cormorant Garamond + Manrope, #F8F5F0/#6E1C1E/#E55A3D

## What's Been Implemented

### Phase 1 - Skeleton Template
### Phase 2 - Authentication & Identity (JWT + Google OAuth + Guest)
### Phase 3 - Mobile-First Responsive Design
### Phase 4 - Product/Menu Item Catalog (CRUD + gallery + availability)
### Phase 5 - Categories & Subcategories (hierarchy + landing pages)

### Phase 6 - Modifiers, Add-Ons & Customization (Current)
- [x] **Required Choice Groups**: Size (Small/Medium/Large) with radio buttons, REQUIRED badge, pre-selected default, real-time price updates
- [x] **Optional Add-Ons Checklist**: Extra Cheese +$1.50, Extra Shot +$0.75, Truffle Oil +$3, Avocado +$2.50 with checkboxes and max selection limits
- [x] **Special Instructions**: Text field preserved in cart
- [x] **Real-time Pricing**: Price updates live as modifiers selected, shows "(base $X + $Y modifiers)" breakdown
- [x] **Modifier Validation**: Error state with red border and message when required group not completed
- [x] **Cart with Modifiers**: Unique line items per modifier combination, shows "Size: Large +$6.00", "Add-Ons: Extra Cheese +$1.50" below item name
- [x] **Context-specific Modifiers**: Temperature (required) for drinks only, Protein Choice (optional) for mains only
- [x] **Admin Modifier Management** (`/admin/modifiers`): List with type badges, option previews, linked item counts, edit/delete
- [x] **Admin Add/Edit Form**: Group name, type (required/optional), min/max selections, dynamic option rows with prices, linked items grid with Select All/Clear
- [x] **Backend**: Full CRUD, 4 seeded groups, item-modifier linkage via linked_item_ids

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Prioritized Backlog
### P0
- Order placement flow (cart → order creation)
- Payment integration (Stripe)
### P1
- Order tracking, Kitchen display, Admin analytics
### P2
- Loyalty, subscriptions, search, notifications
