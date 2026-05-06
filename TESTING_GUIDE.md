# 🧪 POS Claim Testing Guide

## ⚠️ Important: Run These Commands First!

```bash
# 1. Go to backend folder
cd nestjs_backend

# 2. Run migration (add new fields to database)
psql -U your_username -d your_database_name -f prisma/migrations/add_transfer_request_to_claim.sql

# 3. Generate Prisma client (update TypeScript types)
npx prisma generate

# 4. Restart backend
npm run start:dev
```

## 🔍 Check if Claims Data is Coming

### Test Backend API:
```bash
# Get sales orders with claims
curl http://pos.localtest.me:3001/api/pos-sales/orders?limit=5
```

**Expected Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": "xxx",
      "orderNumber": "ORD-xxx",
      "claims": [  // ✅ This should be present
        {
          "id": "claim-id",
          "claimNumber": "CLM-xxx",
          "status": "APPROVED",
          "claimedAmount": 1000,
          "approvedAmount": 1000
        }
      ]
    }
  ]
}
```

## 🎯 Testing Steps

### Step 1: Create a Claim
```
POST http://erp.localtest.me:3001/api/pos-claims
{
  "salesOrderId": "order-uuid",
  "claimType": "RETURN",
  "reasonCode": "DEFECTIVE",
  "items": [...]
}
```

### Step 2: Approve Claim
```
POST http://erp.localtest.me:3001/api/pos-claims/{claimId}/review
{
  "items": [
    {
      "claimItemId": "xxx",
      "approvedQty": 2
    }
  ]
}
```

### Step 3: Check Sales History
```
Open: http://pos.localtest.me:3001/pos/sales/history
```

**Expected to See:**
- 🟢 Green badge: "Claim Approved"
- 🔵 Blue badge: "Transfer Created"

## 🐛 Troubleshooting

### Issue: Claims not showing in sales history

**Check 1: Is Prisma client updated?**
```bash
cd nestjs_backend
npx prisma generate
```

**Check 2: Is backend restarted?**
```bash
npm run start:dev
```

**Check 3: Check browser console**
```
Open DevTools → Console
Look for errors
```

**Check 4: Check API response**
```
Open DevTools → Network → Find /api/pos-sales/orders
Check if "claims" field is present in response
```

### Issue: TypeScript errors

**Solution:**
```bash
cd nestjs_backend
npx prisma generate
npm run start:dev
```

## ✅ Verification Checklist

- [ ] Migration run kiya?
- [ ] Prisma generate kiya?
- [ ] Backend restart kiya?
- [ ] Claims data API response mein aa raha hai?
- [ ] Sales history page pe badges show ho rahe hain?
- [ ] Order details page pe claim section show ho raha hai?

## 📞 Need Help?

If claims still not showing:
1. Check backend logs for errors
2. Check database: `SELECT * FROM pos_claims;`
3. Check if `transfer_request_id` column exists in `pos_claims` table
4. Verify frontend is fetching latest data (clear cache)
