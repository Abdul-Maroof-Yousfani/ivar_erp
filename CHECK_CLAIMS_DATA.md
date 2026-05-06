# 🔍 Check Claims Data - Quick Debug

## Step 1: Check Backend Logs

Open backend terminal and look for errors when you refresh sales history page.

## Step 2: Test API Directly

### Open Browser DevTools:
1. Go to: http://pos.localtest.me:3001/pos/sales/history
2. Press F12 (Open DevTools)
3. Go to **Network** tab
4. Refresh page
5. Find request: `/api/pos-sales/orders`
6. Click on it
7. Go to **Response** tab

### Check Response:
```json
{
  "status": true,
  "data": [
    {
      "id": "xxx",
      "orderNumber": "SO-20260505-0031",
      "claims": []  // ← Is this field present?
    }
  ]
}
```

## Step 3: Check Database

```sql
-- Check if claim exists
SELECT * FROM pos_claims WHERE sales_order_id = 'order-id-from-screenshot';

-- Check if transfer_request_id column exists
\d pos_claims;
```

## Step 4: Run These Commands

```bash
# Go to backend
cd nestjs_backend

# Generate Prisma client
npx prisma generate

# Check for TypeScript errors
npm run build

# Restart backend
npm run start:dev
```

## Step 5: Check Frontend Console

1. Open: http://pos.localtest.me:3001/pos/sales/history
2. Press F12
3. Go to **Console** tab
4. Look for errors

## Expected Behavior:

### If Claims Data is Coming:
- You should see `claims: [...]` in API response
- Icon should appear in Actions column
- Badge should appear in Status column

### If Claims Data is NOT Coming:
- `claims` field will be missing or empty `[]`
- No icon will appear
- No badge will appear

## Quick Fix Commands:

```bash
cd nestjs_backend
npx prisma generate
npm run start:dev
```

Then refresh browser page (Ctrl+Shift+R for hard refresh).
