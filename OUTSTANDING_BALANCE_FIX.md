# Outstanding Balance Calculation Fix

## Problem
Cash-paid orders with "partial" payment status were being incorrectly counted in the outstanding balance. This happened because the system was counting both `unpaid` AND `partial` status orders as outstanding.

## Root Cause
- Backend query was filtering `paymentStatus: { in: ['unpaid', 'partial'] }`
- Frontend calculation was filtering `s.paymentStatus !== 'paid'`
- This meant any order with partial payment (some money paid) was still showing as outstanding

## Solution Implemented

### Backend Changes (`nestjs_backend/src/sales/customer/customer.service.ts`)

**Line 143 - POS Credit Stats Query:**
```typescript
// OLD (WRONG):
const posCreditStats = await this.prisma.salesOrder.aggregate({
  where: {
    customerId: customer.id,
    status: 'completed',
    paymentStatus: { in: ['unpaid', 'partial'] }, // ❌ WRONG
  },
  ...
});

// NEW (CORRECT):
const posCreditStats = await this.prisma.salesOrder.aggregate({
  where: {
    customerId: customer.id,
    status: 'completed',
    paymentStatus: 'unpaid', // ✅ Only truly unpaid orders
  },
  ...
});
```

**Line 237 - Added paymentStatus to query:**
```typescript
const posSales = await this.prisma.salesOrder.findMany({
  where: {
    customerId: customerId,
    status: { in: ['completed', 'partially_returned', 'returned'] },
  },
  select: {
    id: true,
    orderNumber: true,
    grandTotal: true,
    paymentMethod: true,
    paymentStatus: true, // ✅ Added this field
    status: true,
    createdAt: true,
    ...
  },
});
```

### Frontend Changes (`frontend/app/pos/customer-ledger/[customerId]/page.tsx`)

**Line 117 - Outstanding Calculation:**
```typescript
// OLD (WRONG):
const posCreditSales = customer.posSales?.filter((s: any) => s.paymentStatus !== 'paid') || [];

// NEW (CORRECT):
const posCreditSales = customer.posSales?.filter((s: any) => s.paymentStatus === 'unpaid') || [];
```

## Payment Status Logic

### Payment Status Values:
- **`paid`**: Full payment received (totalPaid >= grandTotal)
- **`partial`**: Some payment received but not full (0 < totalPaid < grandTotal)
- **`unpaid`**: No payment received (totalPaid = 0)

### Outstanding Balance Calculation:
```
Outstanding = (ERP Invoices Unpaid) + (POS Orders with paymentStatus='unpaid')
```

**Important:** Orders with `paymentStatus='partial'` should NOT be in outstanding because some payment was already made.

## Credit Sale Flow

When a customer makes a credit sale:
1. Order is created with `paymentStatus: 'unpaid'` (if no payment) or `'partial'` (if some payment)
2. Customer balance is incremented by the credit amount
3. Order shows in customer ledger as outstanding (only if `paymentStatus='unpaid'`)

## Testing Scenarios

### Scenario 1: Full Cash Payment
- Customer pays 1000 for 1000 order
- `paymentStatus: 'paid'`
- Outstanding: 0 ✅

### Scenario 2: Partial Payment
- Customer pays 500 for 1000 order
- `paymentStatus: 'partial'`
- Outstanding: 0 (because partial payment was made) ✅

### Scenario 3: Credit Sale (No Payment)
- Customer pays 0 for 1000 order
- `paymentStatus: 'unpaid'`
- Outstanding: 1000 ✅

## Next Steps

### ⚠️ BACKEND RESTART REQUIRED

The changes have been made to the code, but the backend container needs to be restarted for them to take effect.

**Option 1: Restart Backend Container**
```bash
docker-compose restart nestjs_backend
```

**Option 2: Rebuild and Restart**
```bash
docker-compose down
docker-compose up -d --build
```

**Option 3: Use the rebuild script (if available)**
```bash
./rebuild-container.sh
```

### Verification Steps

After restarting the backend:

1. **Test Full Cash Payment:**
   - Create a POS sale with customer selected
   - Pay full amount in cash
   - Check customer ledger - outstanding should be 0

2. **Test Partial Payment:**
   - Create a POS sale for 1000
   - Pay 500 in cash
   - Check customer ledger - outstanding should be 0 (not 500)

3. **Test Credit Sale:**
   - Create a POS sale with customer selected
   - Click "Credit Sale" button (no payment)
   - Check customer ledger - outstanding should show full amount

4. **Check API Response:**
   - Navigate to `/pos/customer-ledger`
   - Should load without "Failed to fetch" errors
   - Customer list should display correctly

## Files Modified

1. `nestjs_backend/src/sales/customer/customer.service.ts`
   - Line 143: Changed posCreditStats query to filter only `paymentStatus: 'unpaid'`
   - Line 237: Added `paymentStatus` field to posSales query

2. `frontend/app/pos/customer-ledger/[customerId]/page.tsx`
   - Line 117: Changed filter to only count `paymentStatus === 'unpaid'` orders

## Current Status

✅ Code changes completed
⏳ Backend restart pending
⏳ Testing pending

Once the backend is restarted, the outstanding balance calculation should work correctly.
