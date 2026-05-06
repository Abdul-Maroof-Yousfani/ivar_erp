# Complete POS Claim Flow - Step by Step

## 📋 Overview

Yeh complete flow hai customer claim submit karne se lekar paise milne tak.

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAIM FLOW - START TO END                     │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Customer Complaint
    ↓
STEP 2: POS - Claim Submit
    ↓
STEP 3: Print Initial Receipt (SUBMITTED)
    ↓
STEP 4: ERP - Claim Review
    ↓
STEP 5: Customer Notification
    ↓
STEP 6: Print Final Receipt (APPROVED/REJECTED)
    ↓
STEP 7: Refund Processing (if approved)
    ↓
STEP 8: Inventory Transfer (automatic)
```

---

## 📝 Detailed Steps

### STEP 1: Customer Complaint (شکایت)

**Location:** POS Counter

**Customer says:**
> "Yeh product kharab hai" / "Return karna hai" / "Warranty claim karna hai"

**POS Staff checks:**
- ✅ Original receipt hai?
- ✅ Product condition?
- ✅ Warranty period mein hai?
- ✅ Return policy ke mutabiq hai?

**Decision:**
- ✅ Valid → Proceed to Step 2
- ❌ Invalid → Politely refuse with reason

---

### STEP 2: POS - Claim Submit (دعویٰ جمع کرانا)

**Location:** POS System

**Navigation:**
```
POS → Sales History → Select Order → Create Claim
```

**Information Required:**
1. **Order Number:** SO-20260506-0001
2. **Claim Type:** 
   - RETURN (واپسی)
   - EXCHANGE (تبدیلی)
   - DEFECTIVE (خرابی)
3. **Reason Code:**
   - DEFECTIVE (خراب)
   - WRONG_ITEM (غلط سامان)
   - NOT_AS_DESCRIBED (تفصیل کے مطابق نہیں)
   - DAMAGED (ٹوٹا ہوا)
   - OTHER (دیگر)
4. **Items to Claim:**
   - Select items
   - Enter quantities
   - Unit price (auto-filled)
5. **Notes:** Customer ki complaint detail

**System Actions:**
- ✅ Generate Claim Number: CLM-20260506-0001
- ✅ Calculate Claimed Amount
- ✅ Set Status: SUBMITTED
- ✅ Save to database
- ✅ Link to original order

**Result:**
```
✅ Claim Created Successfully
Claim Number: CLM-20260506-0001
Status: SUBMITTED
Amount: Rs. 1,000
```

---

### STEP 3: Print Initial Receipt (ابتدائی رسید)

**Location:** POS Counter

**How to Print:**

**Method 1: From Sales History**
```
1. Sales History table mein order dekho
2. Orange 📄 icon pe click karo
3. Receipt dialog khulega
4. Print button dabao
```

**Method 2: From Order Details**
```
1. Order details page kholo
2. Scroll to "Warranty Claims" section
3. "Print Claim Receipt" button pe click karo
4. Print button dabao
```

**Receipt Shows:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Speed Retail Store
           Main Branch
        +92-XXX-XXXXXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        CLAIM RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claim #:     CLM-20260506-0001
Order #:     SO-20260506-0001
Status:      🟡 SUBMITTED
Submitted:   06/05/2026, 10:15 AM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REASON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Code: DEFECTIVE
Notes: Product not working properly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Product Name       2   Rs.500   Rs.1000
SKU: ABC123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL CLAIMED:              Rs. 1,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────┐
│   ⚠ CLAIM UNDER PROCESS ⚠          │
│ Please keep this receipt for your   │
│ records. You will receive an        │
│ updated receipt once reviewed.      │
└─────────────────────────────────────┘

Thank you for your patience
For queries: +92-XXX-XXXXXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Tell Customer:**
> "Aapka claim submit ho gaya hai. Claim number hai: CLM-20260506-0001. Yeh receipt sambhal kar rakhein. 1-2 din mein review ho jayega aur hum aapko call karenge. Koi sawal?"

**Customer Action:**
- ✅ Receipt sambhal kar rakhna
- ✅ Call ka intezar karna
- ✅ 1-2 din mein follow up

---

### STEP 4: ERP - Claim Review (جائزہ)

**Location:** ERP System

**Who:** Admin / Manager / Authorized Person

**Navigation:**
```
ERP → POS → Claims Management → Pending Claims
```

**Review Process:**

#### 4.1: Start Review
```
1. Claim list mein jao
2. SUBMITTED claims filter karo
3. Claim select karo
4. "Start Review" button pe click karo
5. Status changes: SUBMITTED → UNDER_REVIEW
```

#### 4.2: Review Details
**Check:**
- ✅ Order details
- ✅ Customer history
- ✅ Product condition (if available)
- ✅ Return policy compliance
- ✅ Warranty validity
- ✅ Previous claims

**Decision Options:**
1. **Approve All** - Sab items approve
2. **Approve Partial** - Kuch items approve, kuch reject
3. **Reject All** - Sab items reject

#### 4.3: Item-wise Decision
```
For each item:
- Claimed Qty: 2
- Approve Qty: [0-2]
- Review Notes: "Reason for decision"
```

**Example Decisions:**

**Scenario 1: Full Approval**
```
Item 1: Claimed 2 → Approved 2 ✓
Item 2: Claimed 1 → Approved 1 ✓
Result: APPROVED
```

**Scenario 2: Partial Approval**
```
Item 1: Claimed 2 → Approved 2 ✓
Item 2: Claimed 1 → Approved 0 ✗
Result: PARTIALLY_APPROVED
```

**Scenario 3: Full Rejection**
```
Item 1: Claimed 2 → Approved 0 ✗
Item 2: Claimed 1 → Approved 0 ✗
Result: REJECTED
```

#### 4.4: Submit Review
```
1. Review notes add karo (optional)
2. "Submit Review" button pe click karo
3. System automatically:
   ✅ Updates claim status
   ✅ Calculates approved amount
   ✅ Creates transfer request (if approved)
   ✅ Updates inventory (via transfer)
```

**System Actions (if APPROVED):**
```
✅ Claim Status: APPROVED
✅ Approved Amount: Rs. 1,000
✅ Transfer Request Created: TR-CLM-20260506-0001
✅ Transfer Type: OUTLET_TO_WAREHOUSE
✅ Status: PENDING (will update inventory when processed)
```

---

### STEP 5: Customer Notification (اطلاع)

**Location:** POS Counter / Phone

**Action:** Customer ko call karo

**Script Based on Status:**

#### If APPROVED ✅
**Call Script:**
> "Assalam-o-Alaikum, [Customer Name]. Aapka claim approve ho gaya hai. Claim number: CLM-20260506-0001. Rs. 1,000 refund milega. Aap kab aa sakte hain paise lene?"

**SMS (Optional):**
> "Your claim CLM-20260506-0001 has been APPROVED. Refund: Rs. 1,000. Please visit store with receipt. Speed Retail"

#### If PARTIALLY_APPROVED ⚠
**Call Script:**
> "Assalam-o-Alaikum, [Customer Name]. Aapka claim partially approve hua hai. 2 items mein se 1 approve hui hai. Rs. 500 refund milega. Aap kab aa sakte hain?"

#### If REJECTED ❌
**Call Script:**
> "Assalam-o-Alaikum, [Customer Name]. Maafi chahte hain, aapka claim reject ho gaya hai. Reason: [reason]. Agar koi sawal hai to store pe aa kar baat kar sakte hain."

**Customer Response:**
- ✅ "Main aaj aa jaunga" → Note time
- ✅ "Kal aaunga" → Note date
- ❌ "Nahi aa sakta" → Arrange alternative

---

### STEP 6: Print Final Receipt (حتمی رسید)

**Location:** POS Counter

**When:** Customer store pe aaye

**How to Print:**
```
1. Sales History → Find order
2. Orange 📄 icon pe click karo
3. Updated receipt print karo
```

**Receipt Shows (APPROVED):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        CLAIM RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claim #:     CLM-20260506-0001
Status:      🟢 APPROVED
Submitted:   06/05/2026, 10:15 AM
Reviewed:    06/05/2026, 02:30 PM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Item         Qty  Appr  Price    Amount
─────────────────────────────────────
Product 1     2    2    Rs.500   Rs.1000
✓ APPROVED

Product 2     1    1    Rs.300   Rs.300
✓ APPROVED
─────────────────────────────────────
TOTAL APPROVED:              Rs. 1,300
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────┐
│      ✓ CLAIM APPROVED ✓             │
│ Please present this receipt to      │
│ collect your refund.                │
└─────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Receipt Shows (REJECTED):**
```
Status:      🔴 REJECTED

Review Notes:
Product is not defective. Normal wear
and tear. Not covered under warranty.

┌─────────────────────────────────────┐
│      ✗ CLAIM REJECTED ✗             │
│ Your claim has been rejected.       │
│ Please contact customer service     │
│ for details.                        │
└─────────────────────────────────────┘
```

---

### STEP 7: Refund Processing (واپسی)

**Location:** Cashier Counter

**Only if:** Status = APPROVED or PARTIALLY_APPROVED

#### 7.1: Verify Receipt
```
✅ Check claim number
✅ Check status (must be APPROVED)
✅ Check approved amount
✅ Match with system
```

#### 7.2: Process Refund
**Refund Methods:**

**Option 1: Cash Refund**
```
1. Count cash: Rs. 1,000
2. Give to customer
3. Get signature on receipt copy
4. File receipt
```

**Option 2: Bank Transfer**
```
1. Get customer bank details
2. Process transfer
3. Give receipt
4. Note transaction ID
```

**Option 3: Store Credit**
```
1. Create store credit voucher
2. Give voucher to customer
3. Can use in future purchases
```

#### 7.3: Record Transaction
```
System automatically records:
✅ Refund amount
✅ Refund method
✅ Date & time
✅ Cashier ID
✅ Customer signature (if cash)
```

**Tell Customer:**
> "Yeh aapka Rs. 1,000 refund hai. Receipt pe sign kar dein. Aur koi madad?"

---

### STEP 8: Inventory Transfer (خودکار منتقلی)

**Location:** Automatic (Backend)

**When:** Claim approved

**What Happens:**

#### 8.1: Transfer Request Created
```
Transfer Request: TR-CLM-20260506-0001
Type: OUTLET_TO_WAREHOUSE
From: POS Location (Point of Sales - Corporate)
To: Warehouse Location (Main Warehouse)
Status: PENDING
Items:
  - Product 1: Qty 2
  - Product 2: Qty 1
```

#### 8.2: Warehouse Processing
**Warehouse staff:**
```
1. ERP → Warehouse → Transfer Requests
2. Find: TR-CLM-20260506-0001
3. Verify items received from POS
4. Process transfer
5. Status: PENDING → COMPLETED
```

#### 8.3: Inventory Update
**System automatically:**
```
✅ POS Location:
   - Product 1: -2 (decreased)
   - Product 2: -1 (decreased)

✅ Warehouse Location:
   - Product 1: +2 (increased)
   - Product 2: +1 (increased)

✅ Stock Ledger Entry:
   - Type: POS_CLAIM_RETURN
   - Reference: CLM-20260506-0001
   - Movement: OUT from POS, IN to Warehouse
```

**Note:** Inventory update hota hai jab transfer request PROCESS ho, claim approve hone pe nahi.

---

## 📊 Status Flow Chart

```
┌─────────────┐
│  SUBMITTED  │ ← Initial status (customer submit kare)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│UNDER_REVIEW │ ← Admin review start kare
└──────┬──────┘
       │
       ↓
   ┌───┴───┐
   │       │
   ↓       ↓
┌────────┐ ┌──────────────────┐ ┌──────────┐
│APPROVED│ │PARTIALLY_APPROVED│ │ REJECTED │
└────────┘ └──────────────────┘ └──────────┘
   │              │                   │
   ↓              ↓                   ↓
Refund        Partial Refund      No Refund
   +              +                   
Transfer      Transfer            No Transfer
```

---

## 🎯 Quick Reference Table

| Step | Location | Who | Action | Duration |
|------|----------|-----|--------|----------|
| 1 | POS Counter | Staff | Listen to complaint | 2-5 min |
| 2 | POS System | Staff | Submit claim | 3-5 min |
| 3 | POS Counter | Staff | Print initial receipt | 1 min |
| 4 | ERP System | Admin | Review & decide | 10-30 min |
| 5 | Phone | Staff | Call customer | 2-5 min |
| 6 | POS Counter | Staff | Print final receipt | 1 min |
| 7 | Cashier | Cashier | Process refund | 2-5 min |
| 8 | Warehouse | System | Update inventory | Auto |

**Total Time:** 1-2 days (mostly waiting for review)

---

## 💡 Important Points

### For POS Staff:
1. ✅ Always print initial receipt (SUBMITTED)
2. ✅ Tell customer to keep receipt safe
3. ✅ Note claim number for follow-up
4. ✅ Call customer when reviewed
5. ✅ Print final receipt when customer comes
6. ✅ Verify receipt before refund

### For ERP Admin:
1. ✅ Review claims daily
2. ✅ Check all details carefully
3. ✅ Add clear review notes
4. ✅ Be fair and consistent
5. ✅ Process quickly (1-2 days max)

### For Cashier:
1. ✅ Verify receipt is APPROVED
2. ✅ Match amount with system
3. ✅ Count cash carefully
4. ✅ Get customer signature
5. ✅ File receipt copy

### For Warehouse:
1. ✅ Check transfer requests daily
2. ✅ Verify items received
3. ✅ Process transfers promptly
4. ✅ Update system status

---

## 🚨 Common Issues & Solutions

### Issue 1: Customer Lost Receipt
**Solution:**
```
1. Search by order number
2. Verify customer identity
3. Print duplicate receipt
4. Mark as "DUPLICATE" on receipt
```

### Issue 2: Claim Taking Too Long
**Solution:**
```
1. Check claim status in ERP
2. If SUBMITTED > 2 days, escalate
3. Contact admin/manager
4. Update customer
```

### Issue 3: Partial Approval Dispute
**Solution:**
```
1. Show customer review notes
2. Explain reason clearly
3. Offer to escalate if needed
4. Be polite and professional
```

### Issue 4: Inventory Not Updated
**Solution:**
```
1. Check transfer request status
2. If PENDING, remind warehouse
3. If COMPLETED, check stock ledger
4. Contact IT if still issue
```

---

## 📱 Customer Communication Templates

### SMS Templates

**Claim Submitted:**
```
Your claim CLM-[NUMBER] has been submitted. 
We will review within 1-2 days and contact you. 
Keep your receipt safe. - Speed Retail
```

**Claim Approved:**
```
Good news! Your claim CLM-[NUMBER] is APPROVED. 
Refund: Rs. [AMOUNT]. Please visit store with 
receipt. - Speed Retail
```

**Claim Rejected:**
```
Your claim CLM-[NUMBER] has been reviewed. 
Please visit store or call [PHONE] for details. 
- Speed Retail
```

### Call Scripts

**Opening:**
> "Assalam-o-Alaikum, [Name]. Main [Store Name] se bol raha hoon. Aapka claim [NUMBER] ke baare mein baat karni thi."

**Approved:**
> "Aapka claim approve ho gaya hai. [Amount] refund milega. Aap kab aa sakte hain?"

**Rejected:**
> "Maafi chahte hain, aapka claim reject ho gaya hai kyunke [reason]. Agar koi sawal hai to store pe aa kar baat kar sakte hain."

**Closing:**
> "Aur koi sawal? Shukriya. Allah Hafiz."

---

## ✅ Checklist for Staff

### POS Staff Checklist:
- [ ] Customer complaint suni
- [ ] Original receipt verify ki
- [ ] Product condition check ki
- [ ] Claim submit kiya
- [ ] Initial receipt print ki
- [ ] Customer ko receipt di
- [ ] Claim number note kiya
- [ ] Customer ko process explain kiya
- [ ] Follow-up date note kiya

### Admin Checklist:
- [ ] Claim details review kiye
- [ ] Order history check ki
- [ ] Product condition verify ki
- [ ] Policy compliance check ki
- [ ] Item-wise decision liya
- [ ] Review notes add kiye
- [ ] Decision submit kiya
- [ ] Customer notification arranged

### Cashier Checklist:
- [ ] Receipt verify ki (APPROVED status)
- [ ] Amount match kiya system se
- [ ] Cash count kiya
- [ ] Customer ko diya
- [ ] Signature liya
- [ ] Receipt copy file ki
- [ ] Transaction record kiya

---

**Complete Flow Ready!** 🎉

Yeh complete claim flow hai from start to end. Har step detail mein explain kiya gaya hai.

**Key Points:**
- ✅ 8 clear steps
- ✅ Multiple status tracking
- ✅ Automatic inventory transfer
- ✅ Professional receipts
- ✅ Customer communication
- ✅ Complete documentation

**Training Required:** 30-45 minutes for staff
**System Ready:** Yes, fully functional
**Documentation:** Complete

---

**Last Updated:** May 6, 2026
**Version:** 1.0
**Status:** Production Ready ✅
