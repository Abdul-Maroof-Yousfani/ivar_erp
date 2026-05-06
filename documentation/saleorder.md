# Sales Order Module Documentation (Roman Urdu)

Is document mein Sales Order system ka mukammal flow bataya gaya hai, Customer management se lekar final invoice tak.

## 🎯 Complete Sales Flow

```
Customer Management
   ↓
Sales Order (Direct - No Quotation)
   ↓
Warehouse Verification (Physical Stock Check)
   ↓
Delivery Challan (Goods Dispatch)
   ↓
Sales Invoice (Stock Out + Finance)
   ↓
Receipt Voucher (Payment - Finance Module)
```

## 1️⃣ Customer Management

### Customer Create/Edit
- **Customer Code**: Auto-generate (310001, 310002, etc.)
- **Customer Name**: Business name (ZAHID ASSOCIATES, NIZAM WATCH HOUSE)
- **Contact Details**: Phone, email, address
- **Balance Tracking**: Outstanding receivables

### Sample Customer Data
```
310001 - ZAHID ASSOCIATES
310003 - NIZAM WATCH HOUSE  
310006 - INTERNATIONAL WATCH CO
310007 - GMT DISTRIBUTORS
```

## 2️⃣ Sales Order (Direct Entry)

### Order Creation Process
1. **Customer Selection**: Dropdown se customer select karein
2. **Warehouse Selection**: Stock location select karein (required for item search)
3. **Item Selection**: Advanced search aur filter system
4. **Pricing**: Cost price show hota hai, sale price editable hai
5. **Calculations**: Real-time totals with tax aur discount

### Item Selection Features (Stock Transfer Pattern)
- ✅ **Search by SKU/Description**: 2+ characters type karein
- ✅ **Real-time Inventory Search**: Available stock show hota hai
- ✅ **Brand & Category Filters**: Side sheet mein checkboxes
- ✅ **Popover Dropdown**: Search results show hote hain
- ✅ **Stock Validation**: Available quantity se zyada nahi ja sakta

### Pricing Logic
- **Cost Price**: System automatically show karta hai (item master se)
- **Sale Price**: Default 20% markup, fully editable
- **Item Discount**: Per item discount apply kar sakte hain
- **Order Discount**: Overall order level discount
- **Tax Rate**: Configurable percentage (default 5%)

### Order Status Flow
- **DRAFT**: Order create hone ke baad (no stock effect)
- **CONFIRMED**: Head Office se confirm hone ke baad
- **WAREHOUSE_VERIFIED**: Warehouse staff ne stock check kar liya aur quantity confirm kar di
- **CANCELLED**: Order cancel kar diya

## 3️⃣ Warehouse Verification

### Verification Process
1. **Stock Check**: Warehouse staff confirmed orders dekhta hai.
2. **Physical Audit**: Items ko physically check kiya jata hai.
3. **Quantity Adjustment**: Agar stock kam hai, to staff quantity edit karta hai.
4. **Verification**: "Verify" button click karne se status `WAREHOUSE_VERIFIED` ho jata hai aur totals update ho jatay hain.

### Rules
- ✅ **Mandatory Step**: Verification ke baghair Delivery Challan nahi ban sakta.
- ✅ **Quantity Decrease**: Sirf ordered quantity se kam ya barabar quantity verify ho sakti hai.
- ✅ **Totals Update**: Verification ke waqt subtotal, tax aur grand total automatic update hotay hain.

## 4️⃣ Delivery Challan

### Challan Creation (From Sales Order)
- **Sales Order Selection**: Confirmed orders se select karein
- **Transport Details**: Driver name, vehicle number, transport mode
- **Delivery Quantities**: Partial delivery possible hai
- **Status Tracking**: PENDING → DELIVERED → INVOICED

### Delivery Process
1. Sales Order → Create Delivery Challan
2. Driver aur vehicle details enter karein
3. Delivery quantities confirm karein
4. Status update: DELIVERED
5. Ready for invoicing

### Example Delivery Challan
```
Delivery Challan: DC-001
Sales Order: SO-001
Customer: ZAHID ASSOCIATES
Driver: Ahmed Ali
Vehicle: ABC-123
Transport Mode: SELF

Items:
- T-Shirt: Ordered 100, Delivered 100
- Jeans: Ordered 50, Delivered 50

Status: DELIVERED
```

## 4️⃣ Sales Invoice

### Invoice Creation (From Delivery Challan)
- **Delivery Challan Selection**: DELIVERED status wale challans
- **Automatic Stock Out**: Inventory se items deduct ho jayenge
- **Journal Entry**: Accounting entries automatic create hongi
- **Receivable Creation**: Customer balance update hoga

### Financial Impact
```
Journal Entry (Auto-Create):
Accounts Receivable    Dr  126,000
    Sales Revenue          Cr  120,000
    Tax Payable           Cr    6,000
```

### Stock Impact
```
Stock Ledger Entry:
Item: T-Shirt, Out: 100, Warehouse: Main, Ref: INV-001
Item: Jeans, Out: 50, Warehouse: Main, Ref: INV-001
```

### Invoice Status
- **PENDING**: Payment pending
- **PARTIAL**: Partially paid
- **PAID**: Fully paid
- **CANCELLED**: Invoice cancelled

## 5️⃣ Receipt Voucher (Finance Module)

### Payment Recording
- **Existing Finance Module**: `/erp/finance/receipt-voucher/create`
- **Customer Payment**: Cash, Bank, Cheque, Online
- **Invoice Linking**: Specific invoice ke against payment
- **Receivable Clearing**: Customer balance clear hoga

### Payment Journal Entry
```
Journal Entry:
Cash/Bank             Dr  126,000
    Accounts Receivable   Cr  126,000
```

## 🗂️ Database Schema

### Customer Table
```sql
customers:
- id, code (310001), name, address, contactNo, email
- balance (outstanding amount)
- createdAt, updatedAt
```

### Sales Order Tables
```sql
sales_orders:
- id, orderNo (SO-001), customerId, warehouseId
- orderDate, status, subtotal, taxRate, taxAmount, discount, grandTotal

sales_order_items:
- id, salesOrderId, itemId, costPrice, salePrice, quantity, discount, total
```

### Delivery Challan Tables
```sql
delivery_challans:
- id, challanNo (DC-001), salesOrderId, customerId
- challanDate, deliveryDate, driverName, vehicleNo, transportMode
- status, totalQty, totalAmount

delivery_challan_items:
- id, deliveryChallanId, itemId, orderedQty, deliveredQty, salePrice, total
```

### Sales Invoice Tables
```sql
sales_invoices:
- id, invoiceNo (INV-001), salesOrderId, deliveryChallanId, customerId
- invoiceDate, dueDate, status, subtotal, taxAmount, grandTotal
- paidAmount, balanceAmount

sales_invoice_items:
- id, salesInvoiceId, itemId, costPrice, salePrice, quantity, discount, total
```

## 🚀 API Endpoints

### Customer APIs
```
GET    /api/sales/customers          - List customers
POST   /api/sales/customers          - Create customer
GET    /api/sales/customers/:id      - Get customer details
PUT    /api/sales/customers/:id      - Update customer
DELETE /api/sales/customers/:id      - Delete customer
GET    /api/sales/customers/:id/balance - Get customer balance
```

### Sales Order APIs
```
GET    /api/sales/orders             - List orders
POST   /api/sales/orders             - Create order
GET    /api/sales/orders/:id         - Get order details
PUT    /api/sales/orders/:id         - Update order
POST   /api/sales/orders/:id/confirm - Confirm order
POST   /api/sales/orders/:id/cancel  - Cancel order
POST   /api/sales/orders/:id/delivery-challan - Create delivery challan
```

### Delivery Challan APIs
```
GET    /api/sales/delivery-challans  - List challans
POST   /api/sales/delivery-challans  - Create challan
GET    /api/sales/delivery-challans/:id - Get challan details
POST   /api/sales/delivery-challans/:id/delivered - Mark delivered
POST   /api/sales/delivery-challans/:id/invoice - Create invoice
```

### Sales Invoice APIs
```
GET    /api/sales/invoices           - List invoices
POST   /api/sales/invoices           - Create invoice
GET    /api/sales/invoices/:id       - Get invoice details
GET    /api/sales/invoices/:id/pdf   - Download PDF
GET    /api/sales/invoices/summary   - Get summary stats
```

## 🎯 Business Rules

### Sales Order Rules
- ✅ **No Stock Effect**: Order create karne se stock nahi katega
- ✅ **Price Flexibility**: Sale price fully editable hai
- ✅ **Stock Validation**: Available stock se zyada order nahi kar sakte
- ✅ **Customer Required**: Customer selection mandatory hai
- ✅ **Warehouse Required**: Item search ke liye warehouse zaroori hai

### Delivery Challan Rules
- ✅ **Verified Orders Only**: Sirf warehouse verified orders se challan bana sakte hain
- ✅ **Partial Delivery**: Kam quantity deliver kar sakte hain (agar mazeed stock shortage ho)
- ✅ **Transport Details**: Driver aur vehicle info optional hai
- ✅ **No Stock Effect**: Challan create karne se stock nahi katega

### Sales Invoice Rules
- ✅ **Stock Out Effect**: Invoice create karne se stock katega
- ✅ **Journal Entry**: Automatic accounting entries hongi
- ✅ **Receivable Creation**: Customer balance update hoga
- ✅ **One-time Process**: Ek baar invoice create hone ke baad reverse nahi kar sakte

### Payment Rules
- ✅ **Finance Module**: Existing receipt voucher use karein
- ✅ **Invoice Linking**: Specific invoice ke against payment record karein
- ✅ **Multiple Payments**: Partial payments allowed hain
- ✅ **Balance Tracking**: Customer balance automatic update hoga

## 🔧 Technical Implementation

### Frontend Features
- **Advanced Item Search**: Stock transfer pattern use kiya gaya hai
- **Real-time Calculations**: Totals automatic update hote hain
- **Filter System**: Brand aur category filters available hain
- **Responsive Design**: Mobile-friendly interface
- **Error Handling**: Proper validation aur error messages

### Backend Features
- **Transaction Safety**: Database transactions use kiye gaye hain
- **Stock Validation**: Real-time stock checking
- **Auto Numbering**: Order, challan, invoice numbers automatic generate hote hain
- **Audit Trail**: Created/updated by tracking
- **Error Handling**: Proper exception handling

### Integration Points
- **Inventory Module**: Stock search aur validation
- **Finance Module**: Journal entries aur receipt vouchers
- **Master Data**: Items, customers, warehouses
- **User Management**: Created/updated by tracking

## 📊 Reports & Analytics

### Available Reports
- **Sales Summary**: Total sales, outstanding amounts
- **Customer Ledger**: Customer-wise transaction history
- **Outstanding Invoices**: Pending payments
- **Item-wise Sales**: Best selling items
- **Profit Analysis**: Cost vs sale price analysis

### Dashboard Metrics
- **Total Orders**: Current month orders
- **Pending Deliveries**: Challans pending delivery
- **Outstanding Amount**: Total receivables
- **Top Customers**: High-value customers

## 🎉 Key Benefits

### Business Benefits
- **No Quotation Overhead**: Direct order creation
- **Flexible Pricing**: Sale price fully editable
- **Stock Control**: Real-time stock validation
- **Complete Audit Trail**: Full transaction tracking
- **Integrated Accounting**: Automatic journal entries

### User Experience
- **Easy Item Selection**: Advanced search aur filters
- **Real-time Calculations**: Instant totals update
- **Mobile Responsive**: Works on all devices
- **Intuitive Interface**: User-friendly design
- **Fast Performance**: Optimized for speed

---

*Note: Ye complete Sales Order module production-ready hai aur existing ERP system ke saath fully integrated hai. Receipt Voucher ke liye existing Finance module use karein.*