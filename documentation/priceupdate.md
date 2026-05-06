# Price Update Implementation Notes

This document summarizes all pricing-related changes implemented in this chat for procurement, inventory, transfer, and POS flows.

## Goal Implemented

Ensure weighted-average based cost updates propagate automatically across:

- GRN (immediate for consumable flows)
- Landed Cost (for fresh and direct PO flows)
- Item master cost
- Stock ledger rates
- Inventory and item search views
- Stock transfer movements
- POS item lookup/new sale

## Key Business Rules Applied

- Weighted average formula:
  - `(oldQty * oldAvg) + (newQty * incomingUnitRate)` divided by `(oldQty + newQty)`
- Quantity is mandatory for valid weighted average.
- `item.unitCost` is treated as current average cost baseline.
- `tenantItemSetting.averageCost` is synchronized with computed weighted average.
- Flow triggers:
  - Consumable PR flow: update at GRN
  - Fresh PR flow: update at Landed Cost posting
  - Direct PO flow: update at Landed Cost posting

## Backend Changes

### 1) GRN weighted average update

**File:** `nestjs_backend/src/warehouse/grn/grn.service.ts`

- Added weighted-average helper and update logic.
- For GRN flows where inventory updates immediately (`shouldUpdateInventory === true`):
  - Compute weighted average
  - Update `item.unitCost`
  - Upsert `tenantItemSetting.averageCost`
  - Save stock ledger inbound `rate` using weighted average

### 2) Landed Cost weighted average update

**File:** `nestjs_backend/src/warehouse/landed-cost/landed-cost.service.ts`

- Added weighted-average helper and applied in:
  - `create(...)`
  - `createLocal(...)`
  - `post(...)`
- For landed cost inbound updates:
  - Compute weighted average
  - Update `item.unitCost`
  - Upsert `tenantItemSetting.averageCost`
  - Save stock ledger inbound `rate` using weighted average

### 3) Inbound unit-rate normalization fix

**File:** `nestjs_backend/src/warehouse/landed-cost/landed-cost.service.ts`

- Added `resolveInboundUnitRate(...)` to prevent treating total value as unit rate.
- Priority for inbound unit rate resolution:
  1. `totalCostPKR / qty`
  2. `unitCostPKR`
  3. `unitPrice`
  4. fallback `0`
- This prevents inflated averages caused by malformed or mis-scaled payloads.

### 4) Old quantity source correction

**Files:**
- `nestjs_backend/src/warehouse/grn/grn.service.ts`
- `nestjs_backend/src/warehouse/landed-cost/landed-cost.service.ts`

- Changed `oldQty` source from `stockLedger` aggregate to actual on-hand inventory:
  - `inventoryItem` aggregate with:
    - `itemId`
    - `warehouseId`
    - `locationId: null`
    - `status: 'AVAILABLE'`
- This was done to avoid double/half distortions from historical ledger aggregation.

### 5) Stock transfer should carry latest updated price

**Files:**
- `nestjs_backend/src/warehouse/stock-movement.service.ts`
- `nestjs_backend/src/warehouse/transfer-request.service.ts`

- Added helper to read current item rate from `item.unitCost`.
- Passed `rate` to all relevant transfer ledger entries:
  - Warehouse -> Outlet (OUTBOUND + INBOUND)
  - Outlet -> Warehouse (OUTBOUND + INBOUND)
  - Outlet -> Outlet (source approval outbound + destination accept inbound)

Result: transfer transactions now use latest updated cost instead of stale/blank rates.

### 6) POS new sale should show new updated price

**File:** `nestjs_backend/src/pos-sales/pos-sales.service.ts`

- Updated POS lookup enrichment to set returned `unitPrice` from latest cost:
  - Prefer `item.unitCost`
  - Fallback to `item.unitPrice`
- Also included `unitCost` in response payload.

Result: `pos/new-sale` lookup and scan show updated/latest price values.

## Frontend Changes

### 1) Direct PO create screen using updated cost

**File:** `frontend/app/erp/procurement/purchase-order/create/page.tsx`

- Added resolver to prefer `unitCost` over `unitPrice` when adding items.
- Applied for:
  - Search item add flow
  - PR-to-PO item mapping flow
- Kept fallback to `unitPrice` if `unitCost` is unavailable.

### 2) Guard against wrong flow type defaults

**File:** `frontend/app/erp/procurement/purchase-order/create/page.tsx`

- Set safer defaults:
  - `orderType = LOCAL`
  - `goodsType = CONSUMABLE`
- Added submit validations for required valid values:
  - `orderType` in `LOCAL | IMPORT`
  - `goodsType` in `CONSUMABLE | FRESH`

Reason: avoid wrong landed-cost logic due to blank type selections.

## Behavior Expected After Changes

- New procurement receipts apply weighted average at correct trigger points.
- Item master cost and tenant average cost are updated automatically.
- Stock ledger rates align with updated cost logic.
- Item search in ERP and POS reflects latest cost-based values.
- Stock transfer postings carry current updated item cost.

## Important Operational Note

- Previously posted wrong/inflated landed-cost records are not auto-corrected by code changes.
- Historical corrections require data correction/revaluation entries for affected items and documents.

## Suggested Verification Checklist

1. **Consumable flow (PR -> ... -> GRN):**
   - Post GRN
   - Confirm weighted average update at GRN
   - Confirm item search shows updated value

2. **Fresh flow (PR -> ... -> GRN -> Landed Cost):**
   - Post Landed Cost
   - Confirm weighted average update at Landed Cost

3. **Direct PO flow (PO -> GRN -> Landed Cost):**
   - Ensure order/goods type are selected
   - Post Landed Cost
   - Verify no inflated per-unit rates

4. **Stock transfer:**
   - Transfer item between warehouse/outlet
   - Confirm transfer ledger entries include current rate

5. **POS new sale:**
   - Search/scan item on `pos/new-sale`
   - Confirm displayed unit price follows updated item cost
