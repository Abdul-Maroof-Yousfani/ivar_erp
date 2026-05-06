# Claim Receipt System - اردو گائیڈ

## کیا بنایا گیا؟

Customer ko claim ki receipt dene ka system jo 2 stages mein kaam karta hai:

### Stage 1: Claim Submit Karte Waqt
```
Customer → Claim Submit → Receipt Print (SUBMITTED)
```

**Receipt mein:**
- Claim Number: CLM-20260506-0001
- Status: SUBMITTED (زیر التواء)
- Claimed Items aur Amount
- Notice: "⚠ CLAIM UNDER PROCESS ⚠"

**Customer ko kehna:**
> "Aapka claim submit ho gaya hai. Yeh receipt sambhal kar rakhein. 1-2 din mein review hoga aur hum call karenge."

### Stage 2: Claim Approve/Reject Hone Par
```
ERP Admin Review → Customer ko bulao → Updated Receipt Print
```

**Receipt mein:**
- Status: APPROVED ✓ / REJECTED ✗
- Approved Amount (agar approve hua)
- Review Notes
- Notice based on status

**Customer ko kehna:**
- **Agar APPROVED:** "Mubarak ho! Aapka claim approve ho gaya. Yeh receipt le kar cashier se paise le lein."
- **Agar REJECTED:** "Maafi chahte hain, claim reject ho gaya. Customer service se contact karein."

## Receipt Kaise Print Karein?

### Method 1: Order Details Se

1. **POS → Sales History** mein jao
2. Order pe click karo (jo claim wala ho)
3. Neeche **"Warranty Claims"** section mein jao
4. **"Print Claim Receipt"** button pe click karo
5. Receipt dialog khulega
6. **"Print"** button dabao

## Receipt Mein Kya Hoga?

### Header
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Speed Retail Store
           Main Branch
        +92-XXX-XXXXXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        CLAIM RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Claim Info
```
Claim #:     CLM-20260506-0001
Order #:     SO-20260506-0001
Status:      SUBMITTED / APPROVED / REJECTED
Submitted:   06/05/2026, 10:15 AM
```

### Items Table
```
Item              Qty  Price    Amount
─────────────────────────────────────
Product Name       2   Rs.500   Rs.1000
SKU: ABC123

Product Name 2     1   Rs.300   Rs.300
SKU: XYZ789
─────────────────────────────────────
TOTAL CLAIMED:              Rs. 1,300
```

### Important Notice (Status ke mutabiq)

**SUBMITTED:**
```
┌─────────────────────────────────────┐
│   ⚠ CLAIM UNDER PROCESS ⚠          │
│ Yeh receipt sambhal kar rakhein.    │
│ Review ke baad updated receipt      │
│ milegi.                             │
└─────────────────────────────────────┘
```

**APPROVED:**
```
┌─────────────────────────────────────┐
│      ✓ CLAIM APPROVED ✓             │
│ Yeh receipt le kar cashier se      │
│ paise le lein.                      │
└─────────────────────────────────────┘
```

**REJECTED:**
```
┌─────────────────────────────────────┐
│      ✗ CLAIM REJECTED ✗             │
│ Aapka claim reject ho gaya hai.    │
│ Customer service se contact karein. │
└─────────────────────────────────────┘
```

## Status Colors (رنگ)

| Status | Color | Icon | Matlab |
|--------|-------|------|--------|
| SUBMITTED | 🟡 Yellow | ⏳ | Abhi review nahi hua |
| UNDER_REVIEW | 🔵 Blue | ⚠ | Review ho raha hai |
| APPROVED | 🟢 Green | ✓ | Claim approve ho gaya |
| PARTIALLY_APPROVED | 🟠 Orange | ⚠ | Kuch items approve hue |
| REJECTED | 🔴 Red | ✗ | Claim reject ho gaya |

## Kaam Ka Tareeqa (Workflow)

```
1. Customer claim submit kare
   ↓
2. Receipt print karo (SUBMITTED)
   ↓
3. Customer ko receipt do aur kehna: "Sambhal kar rakhein"
   ↓
4. ERP admin review karega
   ↓
5. Customer ko call karo
   ↓
6. Customer aaye to updated receipt print karo
   ↓
7. Agar APPROVED: Cashier se paise dilwao
   Agar REJECTED: Reason batao
```

## Customer Se Baat Cheet

### Claim Submit Karte Waqt
**Urdu:** 
> "Aapka claim submit ho gaya hai. Claim number hai: CLM-20260506-0001. Yeh receipt sambhal kar rakhein. 1-2 din mein review ho jayega aur hum aapko call karenge. Koi sawal?"

### Claim Approve Hone Par
**Urdu:**
> "Mubarak ho! Aapka claim approve ho gaya hai. Rs. 1,000 refund milega. Yeh receipt le kar cashier counter pe jao aur paise le lo."

### Claim Reject Hone Par
**Urdu:**
> "Maafi chahte hain, aapka claim reject ho gaya hai. Reason yeh hai: [reason]. Agar koi sawal hai to customer service se baat kar sakte hain."

## Zaroori Baatein

1. ✅ **Hamesha receipt print karo** jab claim submit ho
2. ✅ **Original receipt customer ke paas rahe**
3. ✅ **Customer ko call karo** jab review ho jaye
4. ✅ **Updated receipt print karo** jab customer paise lene aaye
5. ✅ **Receipt verify karo** paise dene se pehle
6. ✅ **Copy file mein rakho** record ke liye

## Agar Masla Ho?

### Receipt print nahi ho rahi?
- Printer check karo
- Claim ID sahi hai?
- Browser console mein error dekho

### Claim nazar nahi aa raha?
- Page refresh karo (Ctrl + Shift + R)
- Claim properly create hua?
- Backend logs check karo

### Galat status show ho raha?
- ERP mein claim update hua hoga
- Order details page refresh karo
- Database mein status check karo

## Files Banaye Gaye

1. ✅ `frontend/components/pos/print-claim-receipt.tsx` - Receipt component
2. ✅ `frontend/app/pos/sales/order-details/[id]/page.tsx` - Print button add kiya
3. ✅ `documentation/pos-claim-receipt-system.md` - Detailed documentation
4. ✅ `CLAIM_RECEIPT_URDU_GUIDE.md` - Yeh file

## Kaise Test Karein?

1. **Browser refresh karo:** Ctrl + Shift + R
2. **POS → Sales History** mein jao
3. Koi order jo claim wala ho, usko kholo
4. Neeche **"Warranty Claims"** section dekho
5. **"Print Claim Receipt"** button pe click karo
6. Receipt preview dekho
7. **"Print"** button dabao

## Example Scenario

### Scenario 1: Simple Approval
```
1. Customer: "Yeh product kharab hai, return karna hai"
2. POS: Claim submit karo → Receipt print karo
3. Customer ko: "Yeh receipt rakhein, 2 din mein call karenge"
4. ERP Admin: Claim approve kare
5. Customer ko call: "Aapka claim approve ho gaya"
6. Customer aaye: Updated receipt print karo
7. Cashier: Receipt dekh kar Rs. 1,000 refund do
```

### Scenario 2: Partial Approval
```
1. Customer: "2 items return karne hain"
2. POS: Claim submit karo → Receipt print karo
3. ERP Admin: 1 item approve, 1 reject
4. Customer ko call: "1 item approve hui hai, Rs. 500 milega"
5. Customer aaye: Updated receipt print karo (PARTIALLY_APPROVED)
6. Receipt mein: 1 item ✓ APPROVED, 1 item ✗ REJECTED
7. Cashier: Rs. 500 refund do
```

### Scenario 3: Rejection
```
1. Customer: "Return karna hai"
2. POS: Claim submit karo → Receipt print karo
3. ERP Admin: Claim reject kare (reason: "No defect found")
4. Customer ko call: "Maafi, claim reject ho gaya"
5. Customer aaye: Updated receipt print karo (REJECTED)
6. Reason explain karo
7. Customer service se baat karwao agar zaroorat ho
```

---

**Tayyar hai!** Ab customer ko proper receipt mil jayegi claim ki. 🎉

**Agla Step:** Browser refresh karo aur test karo!
