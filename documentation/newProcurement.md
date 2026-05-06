# New Procurement Flow (A to Z)

## Procurement Flows with Import/Local

### 1. **PR CONSUMABLE Flows** (Immediate inventory update)
- `PR (CONSUMABLE) → RFQ → VQ → PO (LOCAL/IMPORT) → GRN` ✅
- `PR (CONSUMABLE) → Direct PO (LOCAL/IMPORT) → GRN` ✅

### 2. **PR FRESH Flows** (Deferred inventory via Landed Cost)
- `PR (FRESH) → RFQ → VQ → PO (LOCAL/IMPORT) → GRN → Landed Cost` ✅
- `PR (FRESH) → Direct PO (LOCAL/IMPORT) → GRN → Landed Cost` ✅

### 3. **Direct PO Flow** (Always deferred via Landed Cost)
- `Direct PO LOCAL (CONSUMABLE/FRESH) → GRN → Landed Cost (Simple Form)` ✅
- `Direct PO IMPORT (CONSUMABLE/FRESH) → GRN → Landed Cost (Complex Form)` ✅

### **Landed Cost Form Navigation:**
- **LOCAL orders** → `/erp/procurement/landed-cost/local` (Simple form - basic fields only)
- **IMPORT orders** → `/erp/procurement/landed-cost/setup` (Complex form - duties, freight, B/L, GD No, etc.)

### **Key Points:**
- **Order Type** (LOCAL/IMPORT) determines which Landed Cost form opens
- **Goods Type** (CONSUMABLE/FRESH) determines when inventory updates
- **Direct PO** always requires Landed Cost regardless of goods type
- **PR-linked flows** depend on goods type for inventory timing
- The system auto-redirects to appropriate Landed Cost form based on PO's `orderType` field

## Overview
- Do flows:
  PR- RFQ → VQ → PO → GRN: GRN par hi inventory update ho jata hai; Landed Cost ki zarurat nahi.
  - PR → Direct PO → GRN: GRN par hi inventory update ho jata hai; Landed Cost ki zarurat nahi.
  - Direct PO (no PR/RFQ) → GRN → Landed Cost: GRN “RECEIVED_UNVALUED” rehta hai; Landed Cost post karne par inventory update hota hai aur GRN “VALUED” ho jata hai.
- JV creation: Landed Cost post par Journal Voucher generate nahi hota (disable).
- Charges: Landed Cost form me charge types (name + COA) se select karke amounts add karte ho; ye sirf valuation info ke liye hain, JV ab nahi banta.

## RFQ → VQ → PO → GRN (Old Flow)
- Path: Purchase Requisition → Request For Quotation → Vendor Quotation → Purchase Order → Goods Receipt Note.
- GRN create hote hi:
  - Stock Ledger me INBOUND entries ban jati hain (referenceType: “GRN”).
  - GRN status “VALUED” set hota hai, Landed Cost applicable nahi hota.
- Code:
  - GRN handling: [grn.service.ts](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/src/warehouse/grn/grn.service.ts)
  - GRN schema: [grn.prisma](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/prisma/schema/warehouse/grn.prisma)
  - Stock ledger service: [stock-ledger.service.ts](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/src/warehouse/stock-ledger/stock-ledger.service.ts)

## PR → Direct PO → GRN (Immediate Valuation)
- Path: Purchase Requisition (Approved) → Direct Purchase Order (PR select) → Goods Receipt Note.
- PO creation:
  - purchaseRequisitionId store hota hai (schema change).
  - Frontend create payload PR id send karta hai.
- GRN create hote hi:
  - Stock Ledger me INBOUND entries ban jati hain (referenceType: “GRN”).
  - GRN status “VALUED”.
- Code:
  - PO schema relation: [purchase-order.prisma](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/prisma/schema/purchase/purchase-order.prisma)
  - PR backref: [purchase-requisition.prisma](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/prisma/schema/purchase/purchase-requisition.prisma)
  - PO service (direct): [purchase-order.service.ts](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/src/purchase/purchase-order/purchase-order.service.ts)
  - Frontend Direct PO: [create/page.tsx](file:///f:/HRM-abdullah/speed-limit/frontend/app/erp/procurement/purchase-order/create/page.tsx)

## Direct PO → GRN → Landed Cost (New Flow)
- Path: Purchase Order (direct) → Goods Receipt Note → Landed Cost.
- GRN stage:
  - GRN status “RECEIVED_UNVALUED”.
  - Stock Ledger par koi entry nahi banti.
- Landed Cost stage:
  - Endpoint: POST /api/landed-cost/post
  - Action: Stock Ledger me INBOUND entries create hoti hain (referenceType: “LANDED_COST”), aur GRN status “VALUED” set hota hai.
  - JV creation disabled: koi Journal Voucher generate nahi hota.
- UI:
  - Page: ERP → Procurement → Landed Cost
  - Modal: Charges rows (Charge Type + COA + Amount), Inventory Account field hidden.
- Code:
  - API controller: [landed-cost.controller.ts](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/src/warehouse/landed-cost/landed-cost.controller.ts)
  - Service (posting logic): [landed-cost.service.ts](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/src/warehouse/landed-cost/landed-cost.service.ts)
  - Frontend page: [landed-cost/page.tsx](file:///f:/HRM-abdullah/speed-limit/frontend/app/erp/procurement/landed-cost/page.tsx)

## Charge Types Setup
- Purpose: Reusable charges define karna (e.g., Freight-in) sath linked COA.
- UI: ERP → Procurement → Landed Cost Setup
- Fields: Name, Account (Chart of Accounts se; group accounts disabled).
- Data:
  - Model: LandedCostChargeType (name, accountId, isActive)
  - Schema: [landed_cost.prisma](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/prisma/schema/warehouse/landed_cost.prisma)
  - Backref: ChartOfAccount → landedCostChargeTypes: [chart-of-account.prisma](file:///f:/HRM-abdullah/speed-limit/nestjs_backend/prisma/schema/finance/chart-of-account.prisma)
- API:
  - List: GET /api/landed-cost/charge-types
  - Create: POST /api/landed-cost/charge-types
- Frontend:
  - Setup page: [setup/page.tsx](file:///f:/HRM-abdullah/speed-limit/frontend/app/erp/procurement/landed-cost/setup/page.tsx)
  - Client API: [lib/api.ts](file:///f:/HRM-abdullah/speed-limit/frontend/lib/api.ts#L564-L582)

## Chart of Accounts
- Source of selectable accounts (leaf accounts only recommended).
- API: GET /finance/chart-of-accounts
- Frontend client API: [lib/api.ts](file:///f:/HRM-abdullah/speed-limit/frontend/lib/api.ts#L560-L562)

## Statuses & Inventory Update
- GRN statuses:
  - RECEIVED_UNVALUED: Direct PO (no PR/RFQ) flow me GRN create ke baad (inventory pending).
  - VALUED: RFQ/VQ flow me aur PR → Direct PO flow me GRN par hi; Direct PO (no PR/RFQ) me Landed Cost post ke baad.
- Stock Ledger entries:
  - RFQ/VQ, PR → Direct: referenceType = “GRN” (GRN par hi).
  - Direct PO (no PR/RFQ): referenceType = “LANDED_COST” (LC post par).

## Error Cases
- GRN already valued: Landed Cost post par error (RFQ/VQ flow ki GRN).
- Invalid account (group): Charge Type create par reject.

## Navigation Summary
- Landed Cost: /erp/procurement/landed-cost
- Landed Cost Setup: /erp/procurement/landed-cost/setup
- Chart of Accounts: /erp/finance/chart-of-accounts

## Notes
- JV creation intentionally disabled in Landed Cost; charges ab sirf valuation context ke liye.
- Inventory Account select frontend me hidden; backend valuation ke liye internal handling hai, magar JV off hone ki wajah se koi financial posting nahi hoti.

## New Fields Added (Order Type & Goods Type)
- PO Schema: orderType (IMPORT/LOCAL) aur goodsType (CONSUMABLE/FRESH) fields add kiye gaye.
- GRN Schema: orderType aur goodsType fields add kiye gaye jo PO se copy hote hain.
- Frontend PO Create: Order Type aur Goods Type select fields add kiye gaye.
- Frontend GRN Create: PO ke Order Type aur Goods Type display hote hain.
- Frontend GRN List: Order Type aur Goods Type columns add kiye gaye.
- Backend: Sab services me new fields handle kiye gaye (create, createFromQuotation, awardFromRfq, createMultiDirect).

## Goods Type Based Flow (New Implementation)
- **PR-linked flows (RFQ→VQ→PO, PR→Direct PO):**
  - **CONSUMABLE goods (PR):** GRN create → inventory update → GRN status "VALUED" → PO "CLOSED"
  - **FINISH GOODS (PR):** GRN create → no inventory → GRN status "RECEIVED_UNVALUED" → Landed Cost required → inventory update → GRN "VALUED" → PO "CLOSED"
- **Direct PO flow (no PR/RFQ):**
  - Always goes through Landed Cost (current logic maintained)
  - GRN create → no inventory → GRN status "RECEIVED_UNVALUED" → Landed Cost required → inventory update → GRN "VALUED" → PO "CLOSED"
- **Logic Priority:** 
  1. Direct PO: Always Landed Cost
  2. PR-linked: Check PR goodsType field
  3. Stock Ledger referenceType: "GRN" for immediate, "LANDED_COST" for deferred

## Landed Cost Form Updates
- Main Landed Cost page me Order Type filter add kiya (All/Local/Import).
- Local purchases ke liye simple form banaya: `/erp/procurement/landed-cost/local`
  - Sirf basic fields: GRN selection, items summary, PKR currency
  - Complex import fields hide hain (LC No, B/L, GD No, freight, duties, etc.)
  - Direct stock ledger update with PO prices
- Import purchases ke liye existing complex form: `/erp/procurement/landed-cost/setup`
  - Sab import-related fields show hote hain
  - Full duty calculation, MIS details, etc.
- Auto-redirect: GRN select karne par order type ke basis par appropriate form open hota hai
- Backend APIs:
  - POST /api/landed-cost/local - Local purchases ke liye
  - POST /api/landed-cost/post - Simple posting with charges
  - Existing POST /api/landed-cost - Complex import posting

## New Flow (newflowkenaam sy)

### **✅ Implementation Summary:**

**PR CONSUMABLE Flows (Immediate inventory):**
- PR CONSUMABLE → RFQ → VQ → PO → GRN ✅
- PR CONSUMABLE → Direct PO → GRN ✅

**PR FRESH Flows (Deferred inventory):**
- PR FRESH → RFQ → VQ → PO → GRN → Landed Cost ✅
- PR FRESH → Direct PO → GRN → Landed Cost ✅

**Direct PO Flow (Deferred inventory):**
- Direct PO (CONSUMABLE/FRESH) → GRN → Landed Cost ✅

### **Detailed Flow Mapping:**

- **PR CONSUMABLE Flows:**
  - PR (CONSUMABLE) → RFQ → VQ → PO → GRN ✅ (Immediate inventory update)
  - PR (CONSUMABLE) → Direct PO → GRN ✅ (Immediate inventory update)

- **PR FRESH Flows:**  
  - PR (FRESH) → RFQ → VQ → PO → GRN → Landed Cost ✅ (Deferred inventory)
  - PR (FRESH) → Direct PO → GRN → Landed Cost ✅ (Deferred inventory)

- **Direct PO Flow:**
  - Direct PO (CONSUMABLE/FRESH) → GRN → Landed Cost ✅ (Deferred inventory)
  - **Note:** Supports both Local and Import types.

### **Landed Cost Form Navigation:**
- **Auto-Redirect Logic:**
  - Based on PO/GRN `orderType`:
    - **IMPORT** → Opens complex Import Landed Cost setup.
    - **LOCAL** → Opens simplified Local Landed Cost setup.

### **Backend Verification Status:**
1. ✅ **PR Schema:** `goodsType` field present.
2. ✅ **PO/GRN Schema:** `orderType` + `goodsType` fields present.
3. ✅ **PR Service:** Defaults to "CONSUMABLE".
4. ✅ **GRN Service:** Logic unified based on `goodsType`.
5. ✅ **Landed Cost Service:** Logic unified to handle both import and local FINISH GOODS.

### **Frontend Verification Status:**
1. ✅ **PR Form:** Goods Type selection integrated.
2. ✅ **GRN List:** Correct status based filtering for Landed Cost.
3. ✅ **Landed Cost:** Integrated logic for local/fresh purchases at `/erp/procurement/landed-cost/local`.

### **Technical Breakdown:**

**Backend:**
1. **PR Schema:** Added `goodsType` (CONSUMABLE/FRESH).
2. **PO/GRN Schema:** Added `orderType` (LOCAL/IMPORT) and `goodsType`.
3. **Services:**
   - `PurchaseOrderService`: Propagates `goodsType` from PR during award/creation.
   - `GrnService`: Unifies inventory update logic:
     - `CONSUMABLE` → Immediate inventory update, GRN status `VALUED`.
     - `FRESH` → Deferred to Landed Cost, GRN status `RECEIVED_UNVALUED`.
   - `LandedCostService`: Handles both import and local/fresh stock valuation.

**Frontend:**
1. **PR Form:** Choice of Goods Type (Consumable/Fresh).
2. **GRN List:** Filtering updated to show `RECEIVED_UNVALUED` GRNs for Landed Cost setup.
3. **Landed Cost:** Integrated logic for local/fresh purchases.
