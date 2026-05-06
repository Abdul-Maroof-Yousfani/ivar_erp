# Stock Transfer & POS Receiving System - Complete Documentation

## 1. System Architecture Overview

### **Simple Setup:**
- **1 Warehouse** (simple name, no complex locations)
- **Multiple Outlets** (shop locations with specific IDs)
- **Transfer Flow:** Warehouse → Outlet Location (one-way)

---

## 2. Database Schema & Tables

### **Core Tables:**

#### **2.1 Warehouse Table**
```sql
model Warehouse {
  id                 String              @id @default(uuid())
  code               String              @unique
  name               String              -- Simple warehouse name
  address            String?
  description        String?
  isActive           Boolean             @default(true)
  managerId          String?
  companyId          String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  createdById        String?
  updatedById        String?
  inventoryItems     InventoryItem[]     -- Direct relation to inventory
  stockLedgerEntries StockLedger[]
  transfersFrom      TransferRequest[]   @relation("TransferRequestFromWH")
}
```

#### **2.2 InventoryItem Table (Current Stock Levels)**
```sql
model InventoryItem {
  id          String    @id @default(uuid())
  warehouseId String    -- Always references the main warehouse
  locationId  String?   -- NULL = warehouse stock, NOT NULL = outlet stock
  itemId      String    -- Reference to Item
  quantity    Decimal   @default(0) @db.Decimal(15, 4)
  status      String    @default("AVAILABLE")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  item        Item      @relation(fields: [itemId], references: [id])
}
```

**Key Logic:**
- `locationId = NULL` → **Warehouse Stock**
- `locationId = outlet-id` → **Outlet Stock**

#### **2.3 TransferRequest Table (Transfer Tracking)**
```sql
model TransferRequest {
  id              String                @id @default(uuid())
  requestNo       String                @unique -- Format: TR-{timestamp}
  fromWarehouseId String                -- Always from warehouse
  toLocationId    String                -- Always to outlet location
  status          String                @default("PENDING") -- PENDING → COMPLETED
  requestDate     DateTime              @default(now())
  expectedDate    DateTime?
  createdById     String?
  approvedById    String?
  notes           String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  items           TransferRequestItem[] -- Items to transfer
  fromWarehouse   Warehouse             @relation("TransferRequestFromWH", fields: [fromWarehouseId], references: [id])
}
```

#### **2.4 TransferRequestItem Table (Transfer Items)**
```sql
model TransferRequestItem {
  id                String          @id @default(uuid())
  transferRequestId String
  itemId            String
  quantity          Decimal         @db.Decimal(15, 4)
  fulfilledQty      Decimal         @default(0) @db.Decimal(15, 4)
  transferRequest   TransferRequest @relation(fields: [transferRequestId], references: [id], onDelete: Cascade)
  item              Item            @relation(fields: [itemId], references: [id])
}
```

#### **2.5 StockLedger Table (Audit Trail - Source of Truth)**
```sql
model StockLedger {
  id            String       @id @default(uuid())
  itemId        String       @map("item_id")
  warehouseId   String       @map("warehouse_id")
  qty           Decimal      @db.Decimal(15, 4) -- Positive/Negative values
  referenceType String       @map("reference_type") -- "TRANSFER_REQUEST"
  referenceId   String       @map("reference_id") -- TransferRequest ID
  createdAt     DateTime     @default(now()) @map("created_at")
  locationId    String?      @map("location_id") -- NULL = warehouse, NOT NULL = outlet
  movementType  MovementType @map("movement_type") -- INBOUND/OUTBOUND
  rate          Decimal?     @db.Decimal(15, 4)
  unitCost      Decimal?     @map("unit_cost") @db.Decimal(15, 4)
  item          Item         @relation(fields: [itemId], references: [id])
  warehouse     Warehouse    @relation(fields: [warehouseId], references: [id])
}

enum MovementType {
  INBOUND   -- Stock coming in
  OUTBOUND  -- Stock going out
  TRANSFER  -- Internal transfer
  ADJUSTMENT
  OPENING_BALANCE
}
```

#### **2.6 StockMovement Table (Movement Log)**
```sql
model StockMovement {
  id             String    @id @default(uuid())
  movementNo     String    @unique -- Format: MV-{timestamp}
  itemId         String
  fromLocationId String?   -- NULL for warehouse
  toLocationId   String?   -- Outlet location ID
  quantity       Decimal   @db.Decimal(15, 4)
  type           String    -- "TRANSFER"
  referenceType  String?   -- "TRANSFER_REQUEST"
  referenceId    String?   -- TransferRequest ID
  notes          String?
  movementDate   DateTime  @default(now())
  createdById    String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

---

## 3. Complete Transfer Flow (Step-by-Step)

### **Step A: ERP Admin Side (Request Creation)**

#### **3.1 Item Search & Selection**
```typescript
// Frontend API Call
GET /api/inventory/search?q=SKU&warehouseId=warehouse-id

// Backend Logic (InventoryService.searchInventory)
SELECT items WHERE sku LIKE '%query%'
GROUP BY itemId FROM InventoryItem 
WHERE warehouseId = warehouse-id AND locationId IS NULL
RETURN items with warehouse-only stock
```

#### **3.2 Transfer Request Creation**
```typescript
// Frontend Request
POST /api/transfer-request
{
  fromWarehouseId: "warehouse-id",
  toLocationId: "outlet-id", 
  items: [{ itemId: "item-id", quantity: 2 }],
  notes: "Transfer reason"
}

// Backend Creates
INSERT INTO TransferRequest (status = "PENDING")
INSERT INTO TransferRequestItem (quantity, itemId)
```

### **Step B: POS Manager Side (Acceptance)**

#### **3.3 Incoming Requests Display**
```typescript
// POS Dashboard API
GET /api/transfer-request/incoming?locationId=outlet-id

// Shows pending transfers for specific outlet
```

#### **3.4 Accept Transfer**
```typescript
// POS Accept Action
POST /api/transfer-request/{id}/accept
{ userId: "manager-id" }

// Backend Execution (TransferRequestService.acceptRequest)
1. Find TransferRequest by ID
2. Validate status = "PENDING" 
3. Execute Stock Movement for each item
4. Update status = "COMPLETED"
```

### **Step C: Stock Movement Execution (Automatic)**

#### **3.5 Stock Movement Process**
```typescript
// StockMovementService.executeMovement()

TRANSACTION START:

// 1. Create Movement Log
INSERT INTO StockMovement (
  movementNo: "MV-{timestamp}",
  itemId, quantity, type: "TRANSFER",
  referenceType: "TRANSFER_REQUEST",
  referenceId: transfer-request-id
)

// 2. WAREHOUSE SIDE - Decrease Stock
sourceItem = SELECT FROM InventoryItem 
WHERE warehouseId = warehouse-id 
AND locationId IS NULL  -- Warehouse stock only
AND itemId = item-id

UPDATE InventoryItem 
SET quantity = quantity - transfer-qty
WHERE id = sourceItem.id

// 3. STOCK LEDGER - Warehouse OUTBOUND
INSERT INTO StockLedger (
  itemId, warehouseId, locationId: NULL,
  qty: -transfer-qty,  -- Negative for outbound
  movementType: "OUTBOUND",
  referenceType: "TRANSFER_REQUEST"
)

// 4. OUTLET SIDE - Increase Stock
destItem = SELECT FROM InventoryItem
WHERE locationId = outlet-id AND itemId = item-id

IF destItem EXISTS:
  UPDATE InventoryItem SET quantity = quantity + transfer-qty
ELSE:
  INSERT INTO InventoryItem (
    warehouseId: warehouse-id,  -- Same warehouse reference
    locationId: outlet-id,      -- Outlet location
    itemId, quantity: transfer-qty
  )

// 5. STOCK LEDGER - Outlet INBOUND  
INSERT INTO StockLedger (
  itemId, warehouseId, locationId: outlet-id,
  qty: +transfer-qty,  -- Positive for inbound
  movementType: "INBOUND",
  referenceType: "TRANSFER_REQUEST"
)

TRANSACTION COMMIT
```

---

## 4. Stock Calculation Logic

### **4.1 Warehouse Stock Display**
```sql
-- Search Results (Frontend Display)
SELECT i.*, 
  COALESCE(SUM(inv.quantity), 0) as totalQuantity
FROM Item i
LEFT JOIN InventoryItem inv ON i.id = inv.itemId
WHERE inv.warehouseId = 'warehouse-id'
AND inv.locationId IS NULL  -- Only warehouse stock
AND inv.status = 'AVAILABLE'
GROUP BY i.id
```

### **4.2 Stock Validation (Before Transfer)**
```sql
-- Check Available Warehouse Stock
SELECT quantity FROM InventoryItem
WHERE warehouseId = 'warehouse-id'
AND locationId IS NULL
AND itemId = 'item-id'
AND status = 'AVAILABLE'

-- Validation: quantity >= transfer-qty
```

### **4.3 Audit Trail (Stock Ledger)**
```sql
-- Complete Movement History
SELECT 
  itemId, warehouseId, locationId,
  qty, movementType, referenceType,
  createdAt
FROM StockLedger
WHERE referenceType = 'TRANSFER_REQUEST'
ORDER BY createdAt DESC

-- Double Entry Verification:
-- Each transfer creates 2 entries:
-- 1. OUTBOUND (warehouse, qty: -X)
-- 2. INBOUND (outlet, qty: +X)
```

---

## 5. API Endpoints

### **5.1 Inventory Search**
```
GET /api/inventory/search?q={sku}&warehouseId={id}
Response: [{ id, sku, description, totalQuantity }]
```

### **5.2 Transfer Request Management**
```
POST /api/transfer-request
GET /api/transfer-request?warehouseId={id}&status={status}
GET /api/transfer-request/incoming?locationId={id}
POST /api/transfer-request/{id}/accept
```

### **5.3 Stock Operations**
```
POST /api/stock-operation/move
GET /api/stock-ledger/levels?warehouseId={id}
```

---

## 6. Key Features & Benefits

### **6.1 Automatic Stock Updates**
- ✅ Real-time warehouse stock decrease
- ✅ Automatic outlet stock increase  
- ✅ No manual database queries needed

### **6.2 Complete Audit Trail**
- ✅ Immutable StockLedger entries
- ✅ Double-entry bookkeeping (IN/OUT)
- ✅ Full movement history with references

### **6.3 Error Handling**
- ✅ Insufficient stock validation
- ✅ Transaction-based operations (atomicity)
- ✅ Proper error messages

### **6.4 Simple Architecture**
- ✅ 1 Warehouse → Multiple Outlets
- ✅ No complex warehouse locations
- ✅ Clean, maintainable code

---

## 7. Example Transfer Scenario

### **Initial State:**
```
Warehouse Stock: 10 items
Outlet A Stock: 0 items
Outlet B Stock: 0 items
```

### **Transfer 1: Warehouse → Outlet A (3 items)**
```sql
-- After Accept:
InventoryItem (warehouseId, locationId=NULL): quantity = 7
InventoryItem (warehouseId, locationId=outlet-A): quantity = 3

StockLedger: 
- OUTBOUND (warehouse, qty: -3)
- INBOUND (outlet-A, qty: +3)
```

### **Transfer 2: Warehouse → Outlet B (2 items)**
```sql
-- After Accept:
InventoryItem (warehouseId, locationId=NULL): quantity = 5
InventoryItem (warehouseId, locationId=outlet-A): quantity = 3  
InventoryItem (warehouseId, locationId=outlet-B): quantity = 2

StockLedger:
- OUTBOUND (warehouse, qty: -2)
- INBOUND (outlet-B, qty: +2)
```

### **Final State:**
```
Warehouse Stock: 5 items (10 - 3 - 2)
Outlet A Stock: 3 items
Outlet B Stock: 2 items
Total System Stock: 10 items (verified)
```

---

## 8. Stock Synchronization (FIXED)

### **8.1 Problem Identified**
- **StockLedger** had correct entries (source of truth)
- **InventoryItem** was missing warehouse stock entries
- Stock received via GRN/Landed Cost only created StockLedger entries
- Transfer system needed InventoryItem for fast queries

### **8.2 Solution Implemented**
**Fixed GRN Service:**
```typescript
// Now when stock is received, both tables are updated:
// 1. StockLedger entry (audit trail)
await this.stockLedgerService.createEntry({...});

// 2. InventoryItem sync (performance cache)
if (existingStock) {
  await tx.inventoryItem.update({
    where: { id: existingStock.id },
    data: { quantity: { increment: receivedQty } }
  });
} else {
  await tx.inventoryItem.create({
    warehouseId, locationId: null, itemId, quantity, status: 'AVAILABLE'
  });
}
```

**Fixed Landed Cost Service:**
- Same dual-table update approach
- Ensures InventoryItem stays in sync with StockLedger

### **8.3 For Existing Data**
Run the provided SQL script `sync_existing_stock.sql` to sync existing StockLedger entries to InventoryItem table.

## 9. Troubleshooting

### **9.1 Stock Not Updating After Transfers**
- ✅ Fixed: Stock movement service properly updates both tables
- Check warehouse ID consistency
- Verify transaction completion

### **9.2 Search Showing 0 Stock (Fixed)**
- ✅ Fixed: GRN/Landed Cost now creates InventoryItem entries
- ✅ Fixed: Search uses InventoryItem for fast queries
- For existing data: Run sync script

### **9.3 Transfer Fails**
- Validate sufficient warehouse stock
- Check transfer request status
- Verify outlet location exists

---

**Summary:** This system now provides complete dual-table synchronization with StockLedger as source of truth and InventoryItem as performance cache. All stock operations (receive, transfer, adjust) maintain both tables automatically.
