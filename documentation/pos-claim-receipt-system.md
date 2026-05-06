# POS Claim Receipt System

## Overview (خلاصہ)

Yeh system customer ko claim ki receipt deta hai jab wo return/warranty claim submit karte hain. Receipt 2 stages mein print hoti hai:

1. **Initial Receipt** - Jab claim submit ho (SUBMITTED status)
2. **Final Receipt** - Jab claim approve/reject ho (APPROVED/REJECTED status)

## Workflow (کام کا طریقہ)

### Stage 1: Claim Submission (دعویٰ جمع کرانا)

```
Customer → POS Counter → Claim Submit → Print Receipt (SUBMITTED)
```

**Receipt mein kya hoga:**
- Claim Number (CLM-20260506-0001)
- Order Number (SO-20260506-0001)
- Status: SUBMITTED (زیر التواء)
- Claimed Items with quantities
- Claimed Amount (دعویٰ کی رقم)
- Reason Code & Notes
- **Important Notice:** "⚠ CLAIM UNDER PROCESS ⚠"

**Customer ko kya kehna hai:**
> "Aapka claim submit ho gaya hai. Yeh receipt sambhal kar rakhein. Jab claim review ho jayega, aapko updated receipt milegi."

### Stage 2: Claim Review (دعویٰ کا جائزہ)

```
ERP Admin → Review Claim → Approve/Reject → Customer ko bulao
```

**ERP Admin kya karega:**
1. ERP mein claim review karega
2. Items ko approve/reject karega
3. Review notes add karega
4. Submit karega

### Stage 3: Final Receipt (حتمی رسید)

```
Customer → POS Counter → Print Updated Receipt (APPROVED/REJECTED)
```

**Receipt mein kya hoga:**
- Claim Number
- Status: APPROVED ✓ / PARTIALLY APPROVED ⚠ / REJECTED ✗
- Claimed vs Approved quantities
- Approved Amount (منظور شدہ رقم)
- Review Notes (جائزہ نوٹس)
- **Important Notice based on status:**
  - APPROVED: "✓ CLAIM APPROVED ✓ - Present this receipt to collect your refund"
  - PARTIALLY APPROVED: "⚠ CLAIM PARTIALLY APPROVED ⚠ - Some items not approved"
  - REJECTED: "✗ CLAIM REJECTED ✗ - Contact customer service"

**Customer ko kya kehna hai:**
- **Approved:** "Mubarak ho! Aapka claim approve ho gaya hai. Yeh receipt le kar cashier se paise le lein."
- **Partially Approved:** "Aapka claim partially approve hua hai. Kuch items approve nahi hue. Details receipt mein hain."
- **Rejected:** "Maafi chahte hain, aapka claim reject ho gaya hai. Customer service se contact karein."

## Receipt Types (رسید کی اقسام)

### 1. SUBMITTED Receipt (جمع شدہ)
- **Color:** Yellow/Amber (پیلا)
- **Icon:** ⏳ Clock
- **Purpose:** Proof of claim submission
- **Customer Action:** Wait for review

### 2. UNDER_REVIEW Receipt (زیر جائزہ)
- **Color:** Blue (نیلا)
- **Icon:** ⚠ Alert
- **Purpose:** Claim is being reviewed
- **Customer Action:** Wait for decision

### 3. APPROVED Receipt (منظور شدہ)
- **Color:** Green (سبز)
- **Icon:** ✓ Check
- **Purpose:** Collect refund
- **Customer Action:** Present receipt to cashier for refund

### 4. PARTIALLY_APPROVED Receipt (جزوی منظور شدہ)
- **Color:** Orange (نارنجی)
- **Icon:** ⚠ Warning
- **Purpose:** Collect partial refund
- **Customer Action:** Present receipt to cashier for approved amount

### 5. REJECTED Receipt (مسترد)
- **Color:** Red (سرخ)
- **Icon:** ✗ Cross
- **Purpose:** Claim denied
- **Customer Action:** Contact customer service

## How to Print Receipt (رسید کیسے پرنٹ کریں)

### Method 1: From Order Details Page

1. Navigate to: **POS → Sales History**
2. Click on order with claim badge
3. Scroll to **"Warranty Claims"** section
4. Click **"Print Claim Receipt"** button
5. Receipt dialog will open
6. Click **"Print"** button

### Method 2: From Sales History (Future Enhancement)

- Direct print button in sales history table for orders with claims

## Receipt Information (رسید کی معلومات)

### Header Section
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Speed Retail Store
           Main Branch
        +92-XXX-XXXXXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        CLAIM RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Claim Information
```
Claim #:     CLM-20260506-0001
Order #:     SO-20260506-0001
Claim Type:  RETURN
Status:      [SUBMITTED/APPROVED/REJECTED]
Submitted:   06/05/2026, 10:15 AM
Reviewed:    06/05/2026, 02:30 PM (if finalized)
```

### Reason Section
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REASON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Code: DEFECTIVE
Notes: Product not working properly
```

### Items Table
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Item              Qty  Appr  Price    Amount
─────────────────────────────────────────
Product Name       2    2    Rs.500   Rs.1000
SKU: ABC123
✓ APPROVED

Product Name 2     1    0    Rs.300   Rs.0
SKU: XYZ789
✗ REJECTED
─────────────────────────────────────────
TOTAL APPROVED:              Rs. 1,000
```

### Important Notices

**For SUBMITTED:**
```
┌─────────────────────────────────────┐
│   ⚠ CLAIM UNDER PROCESS ⚠          │
│ Please keep this receipt for your   │
│ records. You will receive an        │
│ updated receipt once reviewed.      │
└─────────────────────────────────────┘
```

**For APPROVED:**
```
┌─────────────────────────────────────┐
│      ✓ CLAIM APPROVED ✓             │
│ Please present this receipt to      │
│ collect your refund.                │
└─────────────────────────────────────┘
```

**For REJECTED:**
```
┌─────────────────────────────────────┐
│      ✗ CLAIM REJECTED ✗             │
│ Your claim has been rejected.       │
│ Please contact customer service     │
│ for details.                        │
└─────────────────────────────────────┘
```

### Footer
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thank you for your patience
For queries: +92-XXX-XXXXXXX

Printed: 06/05/2026, 10:15:30 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Technical Implementation

### Frontend Component
- **File:** `frontend/components/pos/print-claim-receipt.tsx`
- **Component:** `PrintClaimReceipt`
- **Props:**
  - `claim`: Full claim object with items and status
  - `storeName`: Store name (optional)
  - `storeAddress`: Store address (optional)
  - `storePhone`: Store phone (optional)
  - `onClose`: Close handler

### Backend API
- **Endpoint:** `GET /api/pos-claims/:id`
- **Response:** Full claim details with items and sales order info

### Integration Points
1. **Order Details Page:** `frontend/app/pos/sales/order-details/[id]/page.tsx`
   - Shows claims section if order has claims
   - Print button for each claim
   
2. **Sales History Page:** `frontend/app/pos/sales/history/page.tsx`
   - Shows claim status badges
   - Can add direct print button (future)

## Status Flow (حالت کا بہاؤ)

```
SUBMITTED
    ↓
UNDER_REVIEW
    ↓
┌───────────────┬──────────────────┬──────────────┐
│               │                  │              │
APPROVED   PARTIALLY_APPROVED   REJECTED   CANCELLED
```

## Customer Communication (گاہک سے بات چیت)

### At Submission (جمع کرتے وقت)
**Urdu:** "Aapka claim submit ho gaya hai. Claim number hai: CLM-20260506-0001. Yeh receipt sambhal kar rakhein. 1-2 din mein review ho jayega aur hum aapko call karenge."

**English:** "Your claim has been submitted. Claim number is: CLM-20260506-0001. Please keep this receipt safe. We will review it in 1-2 days and call you."

### At Approval (منظوری پر)
**Urdu:** "Mubarak ho! Aapka claim approve ho gaya hai. Rs. 1,000 refund milega. Yeh receipt le kar cashier se paise le lein."

**English:** "Congratulations! Your claim has been approved. You will receive Rs. 1,000 refund. Please present this receipt to the cashier."

### At Partial Approval (جزوی منظوری پر)
**Urdu:** "Aapka claim partially approve hua hai. 2 items mein se 1 approve hui hai. Rs. 500 refund milega. Details receipt mein dekh lein."

**English:** "Your claim has been partially approved. 1 out of 2 items approved. You will receive Rs. 500 refund. Please check receipt for details."

### At Rejection (مسترد ہونے پر)
**Urdu:** "Maafi chahte hain, aapka claim reject ho gaya hai. Reason: [reason]. Agar koi sawal hai to customer service se baat karein."

**English:** "We're sorry, your claim has been rejected. Reason: [reason]. If you have any questions, please contact customer service."

## Best Practices (بہترین طریقے)

1. **Always print receipt immediately** after claim submission
2. **Keep original receipt** with customer
3. **Call customer** when claim is reviewed
4. **Print updated receipt** when customer comes to collect refund
5. **Verify receipt** before giving refund
6. **Store copy** in filing system for records

## Troubleshooting (مسائل کا حل)

### Receipt not printing?
- Check printer connection
- Verify claim ID is correct
- Check browser console for errors

### Claim not showing in order details?
- Refresh the page (Ctrl + Shift + R)
- Verify claim was created successfully
- Check backend logs

### Wrong status showing?
- Claim might be updated in ERP
- Refresh order details page
- Verify claim status in database

## Files Modified/Created

### Created:
1. `frontend/components/pos/print-claim-receipt.tsx` - Claim receipt component
2. `documentation/pos-claim-receipt-system.md` - This documentation

### Modified:
1. `frontend/app/pos/sales/order-details/[id]/page.tsx` - Added print claim button

### Existing (No changes needed):
1. `nestjs_backend/src/pos-claims/pos-claims.service.ts` - Claim service
2. `nestjs_backend/src/pos-claims/pos-claims.controller.ts` - Claim API
3. `nestjs_backend/prisma/schema/pos/pos-claim.prisma` - Claim schema

## Future Enhancements

1. **SMS Notification:** Send SMS when claim is reviewed
2. **Email Receipt:** Email claim receipt to customer
3. **QR Code:** Add QR code to receipt for verification
4. **Barcode:** Add barcode for quick lookup
5. **Multi-language:** Support Urdu text in receipt
6. **Signature:** Add customer signature field
7. **Photo Attachment:** Allow attaching photos of defective items

---

**Last Updated:** May 6, 2026
**Version:** 1.0
**Author:** Kiro AI Assistant
