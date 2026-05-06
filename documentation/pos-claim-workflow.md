# POS Warranty Claim Workflow - Complete Implementation

## Overview
Yeh document POS warranty claim system ka complete workflow explain karta hai - jab customer POS pe item return karta hai warranty/defect ke liye.

## Complete Flow (Urdu + English)

### 1. Claim Submission (POS pe)
**Kya hota hai:**
- Customer POS pe aata hai aur kehta hai ke item defective hai ya warranty claim hai
- POS operator claim create karta hai with:
  - Order number
  - Items jo return ho rahe hain
  - Reason code (defective, warranty, etc.)
  - Claimed quantity

**Status:** `SUBMITTED`

**Database:**
```sql
INSERT INTO pos_claims (
  claim_number,      -- CLM-20260505-0001
  sales_order_id,
  claim_type,        -- RETURN | EXCHANGE | DEFECTIVE
  status,            -- SUBMITTED
  claimed_amount
)
```

### 2. Claim Review (ERP pe)
**Kya hota hai:**
- ERP admin/manager claim ko review karta hai
- Har item ko individually approve/reject kar sakta hai
- Approved quantity set karta hai (partial bhi ho sakta hai)

**Status:** `SUBMITTED` → `UNDER_REVIEW` → `APPROVED/PARTIALLY_APPROVED/REJECTED`

**API Endpoint:**
```
POST /api/pos-claims/:id/review
{
  "items": [
    {
      "claimItemId": "uuid",
      "approvedQty": 2,
      "reviewNotes": "Approved - genuine defect"
    }
  ],
  "reviewNotes": "Overall claim approved"
}
```

### 3. Automatic Actions (Jab Claim Approve Hoti Hai)

#### A. Transfer Request Creation ✅
**Kya hota hai:**
- Approved items ke liye automatically transfer request ban jati hai
- **POS Location → Warehouse Location** (same warehouse, different location)

**Code Location:** `nestjs_backend/src/pos-claims/pos-claims.service.ts` (line ~270)

```typescript
// 1. Get POS location with warehouse
const posLocation = await tx.location.findUnique({
  where: { id: salesOrder.locationId },
  select: { id: true, warehouseId: true }
});

// 2. Get warehouse location (bin/section)
const warehouseLocation = await tx.warehouseLocation.findFirst({
  where: {
    warehouseId: posLocation.warehouseId,
    isActive: true,
    type: 'BIN'
  }
});

// 3. Create transfer request
const transferRequest = await tx.transferRequest.create({
  data: {
    requestNo: 'TR-CLM-20260505-0001',
    fromLocationId: posLocation.id,        // POS Location
    fromWarehouseId: posLocation.warehouseId,
    toWarehouseId: posLocation.warehouseId, // Same warehouse
    transferType: 'OUTLET_TO_WAREHOUSE',
    status: 'PENDING',
    notes: `Target: ${warehouseLocation.name}`,
    items: approvedItems
  }
});
```

**Transfer Request Number Format:** `TR-CLM-YYYYMMDD-XXXX`

### 4. Transfer Request Processing (ERP pe)

**Kya hota hai:**
- ERP warehouse manager transfer request ko dekh sakta hai
- Source approve karta hai (POS se items nikalne ki permission)
- Destination accept karta hai (ERP warehouse mein items receive karta hai)

**Status Flow:**
```
PENDING → SOURCE_APPROVED → COMPLETED
```

**Endpoints:**
```
POST /api/warehouse/transfer-requests/:id/approve-source
POST /api/warehouse/transfer-requests/:id/accept
```

### 5. Sales History Display ✅

**Kya dikhta hai:**
- Sales history table mein claim status badges:
  - 🟡 **Claim Pending** - SUBMITTED/UNDER_REVIEW
  - 🟢 **Claim Approved** - APPROVED/PARTIALLY_APPROVED
  - 🔴 **Claim Rejected** - REJECTED
  - 🔵 **Transfer Created** - Transfer request ban gayi hai

**Order Details Page:**
- Complete claim information with:
  - Claim number
  - Status
  - Claimed vs Approved amounts
  - Item-level details
  - Transfer request link (if created)

## Database Schema

### pos_claims
```sql
CREATE TABLE pos_claims (
  id UUID PRIMARY KEY,
  claim_number VARCHAR UNIQUE,
  sales_order_id UUID,
  claim_type VARCHAR,           -- RETURN | EXCHANGE | DEFECTIVE
  status VARCHAR,                -- SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED
  claimed_amount DECIMAL(15,2),
  approved_amount DECIMAL(15,2),
  transfer_request_id UUID,     -- Link to auto-generated transfer request
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  created_by UUID,
  reviewed_by UUID
);
```

### pos_claim_items
```sql
CREATE TABLE pos_claim_items (
  id UUID PRIMARY KEY,
  claim_id UUID,
  sales_order_item_id UUID,
  item_id UUID,
  claimed_qty INT,
  approved_qty INT,
  unit_paid_price DECIMAL(15,2),
  claimed_amount DECIMAL(15,2),
  approved_amount DECIMAL(15,2),
  item_status VARCHAR            -- PENDING | APPROVED | REJECTED
);
```

## Key Features

### ✅ Implemented Features:
1. **Claim Creation** - POS se claim submit ho sakti hai
2. **Claim Review** - ERP se approve/reject ho sakti hai
3. **Automatic Inventory Update** - Approved items POS inventory mein add ho jati hain
4. **Automatic Transfer Request** - POS to ERP transfer request automatically ban jati hai
5. **Sales History Display** - Claim status sales history mein show hoti hai
6. **Order Details** - Complete claim information order details page pe
7. **Stock Ledger Tracking** - Har movement track hoti hai
8. **Activity Logs** - Sab actions log hote hain

### 🔄 Transfer Request Flow:
```
POS Claim Approved
    ↓
POS Inventory Updated (+items)
    ↓
Transfer Request Created (PENDING)
    ↓
ERP Manager Approves Source
    ↓
POS Inventory Reduced (-items)
    ↓
ERP Warehouse Accepts
    ↓
ERP Inventory Updated (+items)
    ↓
Transfer COMPLETED
```

## API Endpoints

### Claim Management
```
POST   /api/pos-claims                    - Create new claim
GET    /api/pos-claims                    - List all claims
GET    /api/pos-claims/:id                - Get claim details
POST   /api/pos-claims/:id/start-review   - Start review
POST   /api/pos-claims/:id/review         - Submit review decision
POST   /api/pos-claims/:id/cancel         - Cancel claim
```

### Sales History
```
GET    /api/pos-sales/orders              - List orders with claim info
GET    /api/pos-sales/orders/:id          - Get order with claims
```

### Transfer Requests
```
GET    /api/warehouse/transfer-requests   - List transfer requests
POST   /api/warehouse/transfer-requests/:id/approve-source
POST   /api/warehouse/transfer-requests/:id/accept
```

## Migration Required

Run this SQL migration:
```sql
ALTER TABLE pos_claims 
ADD COLUMN IF NOT EXISTS transfer_request_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_pos_claims_transfer_request_id 
ON pos_claims(transfer_request_id);
```

## Testing Checklist

- [ ] Create claim from POS
- [ ] View claim in sales history
- [ ] Review claim in ERP
- [ ] Approve claim
- [ ] Verify POS inventory updated
- [ ] Verify transfer request created
- [ ] Verify stock ledger entries
- [ ] Process transfer request
- [ ] Verify ERP inventory updated
- [ ] Check activity logs

## Notes

1. **ERP Warehouse Selection:** Currently system selects first MAIN warehouse. Adjust logic if needed.
2. **Permissions:** Ensure proper RBAC permissions for claim review and transfer approval.
3. **Notifications:** Consider adding email/SMS notifications for claim status updates.
4. **Partial Approvals:** System supports partial quantity approvals.
5. **Stock Ledger:** All movements tracked with reference type `POS_CLAIM_APPROVED`.

## Summary

**Pura flow:**
1. ✅ POS pe claim submit hoti hai
2. ✅ Sales history mein status show hoti hai
3. ✅ ERP se review hoti hai
4. ✅ Approve hone pe POS inventory update hoti hai
5. ✅ Automatic transfer request ban jati hai
6. ✅ Transfer request process hone pe ERP inventory update hoti hai
7. ✅ Sab kuch track hota hai (stock ledger + activity logs)

**Sab kuch automatic hai - manual intervention sirf review aur transfer approval ke liye chahiye!** 🎉
