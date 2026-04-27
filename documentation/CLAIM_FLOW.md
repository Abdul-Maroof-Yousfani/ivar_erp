# Return Claim Flow — Documentation & Test Guide

## Overview

The claim system handles disputed or defective returns that cannot be processed immediately at the POS counter. Instead of giving a direct refund, the store **submits a claim to ERP**, which reviews and approves the refund amount. This protects the business from unauthorized refunds and creates a proper audit trail.

---

## When to Use Each Operation

| Operation | Use Case | Refund Processed By |
|-----------|----------|---------------------|
| **Return** | Customer returns item, reason is clear, no dispute | POS cashier — immediate |
| **Exchange** | Customer swaps item for another | POS cashier — immediate |
| **Claim** | Defective goods, brand dispute, quality issue, or any case requiring ERP verification | ERP team — after review |

---

## Claim Status Lifecycle

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED
                                 → PARTIALLY_APPROVED
                                 → REJECTED
       → CANCELLED (at any point before finalisation)
```

| Status | Who Sets It | Meaning |
|--------|-------------|---------|
| `DRAFT` | System (unused currently) | Not yet submitted |
| `SUBMITTED` | POS cashier | Claim sent to ERP, awaiting review |
| `UNDER_REVIEW` | ERP reviewer | ERP has opened the claim for review |
| `APPROVED` | ERP reviewer | All claimed items approved at full claimed amount |
| `PARTIALLY_APPROVED` | ERP reviewer | Some items or quantities approved, rest rejected |
| `REJECTED` | ERP reviewer | No items approved |
| `CANCELLED` | POS or ERP | Claim withdrawn before finalisation |

---

## Pricing Rule (Critical)

> **Refunds are always at the price the customer originally paid — not the current market price.**

- If an item was sold at Rs. 7,500 (25% off from Rs. 10,000), the claim is for **Rs. 7,500**.
- If the sale price was Rs. 10,000 (no discount), the claim is for **Rs. 10,000**.
- The system calculates this automatically from `lineTotal / quantity` on the original order.

---

## Step-by-Step Flow

### Step 1 — POS: Find the Original Order

**Path:** POS → Sales → Returns & Exchanges

1. Open `/pos/sales/returns`
2. Type the order number in the search box (e.g. `SO-20260401-0001`)
3. Press **Enter** or click the search button
4. The order details appear below — verify the order number, date, and total

---

### Step 2 — POS: Select "Claim" Tab

1. Three tabs appear: **Return**, **Exchange**, **Claim**
2. Click the **Claim** tab
3. Read the amber notice: *"A Claim is submitted to ERP for review. The store does not process the refund directly."*

---

### Step 3 — POS: Select Items and Quantities

1. The items table shows all items from the original order
2. For each item to claim, use the **+/−** buttons to set the return quantity
3. The table shows:
   - **List Price** — original price before discount
   - **Disc %** — discount applied at time of sale
   - **Paid/Unit** — what the customer actually paid (this is the claim amount)
   - **Amount** — Paid/Unit × return qty
4. The summary panel at the bottom shows the **total claimed amount**

---

### Step 4 — POS: Select Reason Code

Choose the appropriate reason:

| Code | When to Use |
|------|-------------|
| `DEFECTIVE / DAMAGED` | Item arrived broken or became defective |
| `WRONG ITEM DELIVERED` | Customer received a different item than ordered |
| `SIZE / FIT ISSUE` | Item does not fit as expected |
| `QUALITY NOT AS EXPECTED` | Quality below standard |
| `CUSTOMER CHANGED MIND` | Customer simply wants a refund (requires ERP approval) |
| `OTHER` | Any other reason — add notes |

---

### Step 5 — POS: Submit the Claim

1. Optionally add notes in the **Notes** field
2. Click **Submit Claim to ERP** (amber button)
3. A success toast appears: *"Claim CLM-YYYYMMDD-XXXX submitted successfully"*
4. The cashier is redirected to Sales History
5. The original order status does **not** change — the claim is a separate record

---

### Step 6 — ERP: View Submitted Claims

**Path:** ERP → Claims (`/erp/claims`)

1. The claims list shows all claims with their status
2. Filter by **Submitted** to see new claims awaiting review
3. Each row shows: Claim #, Order #, Type, Reason, Claimed Amount, Approved Amount, Status, Submitted Date

---

### Step 7 — ERP: Open Claim for Review

1. Click the **eye icon** on any claim row
2. The detail modal opens showing:
   - Claim header (order number, reason, claimed amount, approved amount)
   - Store notes (if any)
   - Items breakdown table

---

### Step 8 — ERP: Start Review

1. If status is `SUBMITTED`, click **Start Review**
2. Status changes to `UNDER_REVIEW`
3. This signals to the store that ERP is actively reviewing

---

### Step 9 — ERP: Set Approved Quantities Per Item

For each item in the claim:

1. The **Approve Qty** column shows a spinner (default = claimed qty = full approval)
2. Adjust the approved quantity:
   - Set to **claimed qty** → full approval for that item
   - Set to **less than claimed qty** → partial approval
   - Set to **0** → reject that item
3. The **Approved Amt** column updates in real time: `Paid/Unit × Approved Qty`
4. The **Total to Approve** summary at the bottom shows the running total

**Example:**
```
Item: Nike Air Max | Claimed: 2 units @ Rs. 7,500 = Rs. 15,000
Reviewer sets Approve Qty: 1
Approved Amount: Rs. 7,500 (partial)
```

---

### Step 10 — ERP: Add Review Notes and Submit Decision

1. Add notes in the **Review Notes** field (optional but recommended for partial/rejected)
2. Click **Submit Decision**
3. The system auto-determines the overall claim status:
   - All items fully approved → `APPROVED`
   - Some items or quantities approved → `PARTIALLY_APPROVED`
   - All items set to 0 → `REJECTED`
4. Success toast shows: *"Claim approved. Approved: Rs. X,XXX"*

---

### Step 11 — POS: View Claim Result

1. Go to `/erp/claims` or check the claim from the POS side
2. The claim now shows the final status and approved amount
3. The store processes the refund to the customer based on the **approved amount**

---

## Cancellation

A claim can be cancelled at any point **before** it reaches `APPROVED`, `PARTIALLY_APPROVED`, or `REJECTED`:

- From the ERP claims list, open the claim detail
- The cancel option is available while status is `SUBMITTED` or `UNDER_REVIEW`
- Cancelled claims cannot be reopened — a new claim must be submitted

---

## Business Rules Summary

1. **One active claim per order** — if a claim already exists for an order (not rejected/cancelled), a second submission is blocked with an error message.
2. **Voided or hold orders cannot be claimed** — the system validates order status before allowing submission.
3. **Refund amount is always at paid price** — the system uses `lineTotal / quantity` from the original order, not the current item price.
4. **ERP cannot approve more than claimed** — the approved qty is capped at the claimed qty per item.
5. **Claim does not affect stock** — stock is only restored when a Return or Exchange is processed, not when a claim is submitted or approved.

---

## Test Scenarios

### Test 1 — Full Approval
1. Create a sale for 2 items at Rs. 7,500 each (25% off from Rs. 10,000)
2. Submit a claim for both items, reason: Defective
3. ERP opens claim → Start Review → leave both items at qty 2 → Submit Decision
4. **Expected:** Status = `APPROVED`, Approved Amount = Rs. 15,000

### Test 2 — Partial Approval
1. Same sale as above
2. Submit claim for both items
3. ERP sets item 1 approved qty = 1, item 2 approved qty = 0
4. **Expected:** Status = `PARTIALLY_APPROVED`, Approved Amount = Rs. 7,500

### Test 3 — Full Rejection
1. Submit claim for any order
2. ERP sets all items to approved qty = 0
3. **Expected:** Status = `REJECTED`, Approved Amount = Rs. 0

### Test 4 — Duplicate Claim Block
1. Submit a claim for order SO-XXXX
2. Try to submit another claim for the same order
3. **Expected:** Error — *"An active claim (CLM-XXXX) already exists for this order"*

### Test 5 — Pricing Rule Verification
1. Create a sale: item listed at Rs. 10,000, sold at 25% off → paid Rs. 7,500
2. Submit claim for 1 unit
3. **Expected:** Claimed amount = Rs. 7,500 (not Rs. 10,000)

### Test 6 — Cancellation
1. Submit a claim
2. Open in ERP → Start Review
3. Cancel the claim
4. **Expected:** Status = `CANCELLED`, cannot be reopened

---

## API Reference (for testing via Postman/Swagger)

| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| `POST` | `/api/pos-claims` | POS | Submit new claim |
| `GET` | `/api/pos-claims` | ERP | List claims (filter: `?status=SUBMITTED`) |
| `GET` | `/api/pos-claims/:id` | ERP | Get full claim detail |
| `POST` | `/api/pos-claims/:id/start-review` | ERP | Mark as under review |
| `POST` | `/api/pos-claims/:id/review` | ERP | Submit approval decision |
| `POST` | `/api/pos-claims/:id/cancel` | Both | Cancel claim |

### Sample Submit Claim Payload
```json
{
  "salesOrderId": "uuid-of-order",
  "claimType": "RETURN",
  "reasonCode": "DEFECTIVE",
  "reasonNotes": "Item arrived with broken zipper",
  "items": [
    {
      "salesOrderItemId": "uuid-of-order-item",
      "itemId": "uuid-of-item",
      "claimedQty": 1,
      "unitPaidPrice": 7500
    }
  ]
}
```

### Sample Review Payload
```json
{
  "reviewNotes": "Verified defect — approving 1 unit",
  "items": [
    {
      "claimItemId": "uuid-of-claim-item",
      "approvedQty": 1,
      "reviewNotes": "Defect confirmed by QC"
    }
  ]
}
```
