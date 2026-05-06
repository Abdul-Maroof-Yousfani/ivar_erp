# Point of Sale (POS) - Overall System Flow

This document details the A-to-Z functional and technical flow of the POS module in the Speed Limit project.

## 1. Login & Context Setup
- **User Authentication:** Cashier/User logs into the system.
- **Terminal & Location Selection:** System validates if a `locationId` (store) and `terminalId` (machine) are assigned. If not, the user is prompted to select/assign them to set the operating context.
- **Security:** Access is protected via `JwtAuthGuard` and `PermissionsGuard`.

## 2. Session Management
- **Active Session Check:** The POS dashboard (`/pos`) verifies if there is an 'Open' session for the current terminal.
- **Opening Float:** If no session is active, the cashier must perform an "Open Register" action, providing an **Opening Float** (starting cash amount).
- **Backend Action:** `PosSessionService.openDrawer` records the opening time and amount.

## 3. POS Terminal Operations (`/pos/new-sale`)
- **Product Scanning:** Barcode scan or manual search triggers `PosSalesService.lookupItem`.
- **Real-time Inventory Check:** The system queries the `StockLedger` to show current stock availability (In Stock/Out of Stock) during the search.
- **Cart Management:** Items are added to a local cart. Cashiers can:
    - Adjust quantities.
    - Apply line-level discounts.
    - Remove items.

## 4. Checkout & Discounts
- **Promotion Engine:** The system fetches active promotions for the current location (`PosConfigService.getCheckoutConfig`).
- **Coupons:** Manual coupon codes can be validated against usage limits and expiry dates.
- **Alliance Discounts:** Integration with partner/bank discounts (e.g., Credit Card specific offers).
- **Calculations:** The system calculates Subtotal, Taxes, Line Discounts, Global Discounts, and the final Grand Total.

## 5. Payment (Tender)
- **Flexible Tendering:** Supports multiple payment methods:
    - **Cash:** Includes change calculation.
    - **Card:** Captures basic card/slip metadata.
    - **Split Payment:** Allows paying a single bill using a mix of cash and card.
- **Payment Status:** Marks the order as `paid` or `partial`.

## 6. Order Finalization & Persistence
- **Order Generation:** `PosSalesService.createOrder` generates a unique `orderNumber` (e.g., SO-20240309-0001).
- **Data Integrity:** Records the transaction in the Tenant Database (`SalesOrder` & `SalesOrderItem`).
- **Inventory Integration:** (Planned/Verification) Generates an immutable **OUTBOUND** entry in the `StockLedger` to deduct inventory.

## 7. Receipt & Completion
- **Thermal Print Receipt:** A formatted receipt is generated for the customer (`print-receipt.tsx`).
- **Clearance:** The terminal UI resets for the next customer automatically.

## 8. End of Shift (Closing)
- **Cash Counting:** Cashier enters the **Actual Cash** present in the drawer.
- **Reconciliation (Z-Report):** System compares:
    - `Expected Cash` = `Opening Float` + `Cash Sales`.
    - `Difference` = `Actual Cash` - `Expected Cash` (Variance).
- **Session Close:** `PosSessionService.closeDrawer` marks the session as 'Closed' and records the closing timestamp and notes.

---
*Last Updated: 2026-03-09*
