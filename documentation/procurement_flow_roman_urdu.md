# 🛒 Procurement & Purchase Flow - Complete Overview (Roman Urdu)

Yeh document hamare ERP ke Procurement aur Purchase system ka mukammal flow explain karta hai, demand se lekar warehouse mein stock enter hone tak.

---

## 1. Purchase Requisition (PR) — Internal Demand
- **Route**: `/erp/procurement/purchase-requisition`
- **Maqsad**: Jab kisi department (jaise Legal ya IT) ko kisi item ki zaroorat hoti hai, wo PR banata hai.
- **Process**: Items aur unki required quantity specify ki jati hai.
- **Outcome**: PR submit hone ke baad approval cycle se guzarti hai.
- **Status**: `DRAFT` → `SUBMITTED` → `APPROVED`

## 2. Request For Quotation (RFQ) — Sourcing
- **Route**: `/erp/procurement/rfq`
- **Maqsad**: Approved PR ki bunyaad par vendors se rates mangwaye jate hain.
- **Process**: Ek RFQ generate hota hai jise multiple vendors (Suppliers) ko bheja jata hai.
- **Status**: `DRAFT` → `SENT`

## 3. Vendor Quotation — Bidding
- **Route**: `/erp/procurement/vendor-quotation/list`
- **Maqsad**: Vendors apne rates, delivery terms, aur discounts submit karte hain.
- **Update**: Ab Vendor Quotation create hote hi **Auto-Submit** ho jati hai (Admin ko alag se submit nahi karna parta).
- **Process**: HR ya Procurement team in quotations ko compare karti hai aur behtreen offer ko **Select** karti hai.
- **Status**: `SUBMITTED` → `SELECTED` (Direct Submitted state mein create hoti hai)

## 4. Purchase Order (PO) — Ordering
- **Route**: `/erp/procurement/purchase-order`
- **Maqsad**: Vendor ko formal order dena.
- **New Features**:
  1. **Pending POs from Quotations**: Jo Vendor Quotations select ho chuki hain, wo `/erp/procurement/purchase-order/pending` par show hoti hain. Wahan se click karke PO generate kiya jata hai.
  2. **Direct PO**: Agar RFQ/Quotation process skip karna ho, to direct PO create kiya ja sakta hai (`/erp/procurement/purchase-order/create`). Isme Approved PR ko bhi link karne ki option hai.
- **Process**: PO mein final rates, taxes, aur delivery date confirm hoti hain.
- **Status**: `OPEN` (Directly Open state mein create hota hai)

## 5. Goods Receipt Note (GRN) — Receiving
- **Route**: `/erp/procurement/grn` (New Dedicated Route)
- **Maqsad**: Jab vendor saman warehouse mein deliver karta hai, to uski receipt record ki jati hai.
- **Process**:
  - PO select kiya jata hai.
  - Warehouse select kiya jata hai.
  - Actual receive ki gayi quantity (Received Qty) enter ki jati hai.
  - Agar pura saman nahi aaya, to **Partial Receiving** bhi mumkin hai.
- **System Action**:
  - `StockLedger` mein stock-in ki entry hoti hai.
  - PO item ki `receivedQty` update hoti hai.
  - PO ka status automatically change hota hai (`PARTIALLY_RECEIVED` ya `CLOSED`).

## 6. Stock Ledger — Source of Truth
- **Route**: `/erp/inventory/warehouse/inventory` (Inventory Explorer)
- **Key Concept**: Hamare system mein static inventory table ke bajaye **Ledger system** hai.
- **Logic**: Har stock movement (chahe wo GRN se IN ho ya Sales se OUT) ek entry ki surat mein record hoti hai.
- **Fayda**: Is se har unit ka audit trail milta hai aur inventory calculations hamesha accurate rehti hain.

---

## Implementation Status Summary
| Feature | Status | Remarks |
| :--- | :--- | :--- |
| **Purchase Requisition** | ✅ Done | Logic & UI Ready |
| **RFQ** | ✅ Done | Creation & View Ready |
| **Vendor Quotation** | ✅ Done | **Auto-Submit** & Comparison Ready |
| **Purchase Order** | ✅ Done | **Direct PO** & **Pending PO** Flow Added |
| **GRN** | ✅ Done | Dedicated Route & Partial Receiving Ready |
| **Stock Ledger** | ✅ Done | Real-time Stock Entry Ready |
| **Warehouse Management** | ✅ Done | CRUD operations & UI Ready |

---
*Last Updated: 2026-02-13*
