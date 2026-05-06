# Architecture Document: Advanced Warehouse Management System (WMS)

## 1. Executive Summary
The Advanced WMS is a modular extension to the ERP system designed to handle complex inventory scenarios, including multi-warehouse management, hierarchical storage (Bins/Racks), batch/serial tracking, and audit-compliant stock operations.

## 2. System Architecture

### 2.1 Technology Stack
-   **Backend**: NestJS (Modular architecture)
-   **Database**: PostgreSQL (Prisma ORM)
-   **Frontend**: Next.js 14+ (App Router, Tailwind CSS)
-   **State Management**: server-side state (React Server Components) and client-side hooks.

### 2.2 Domain Model (Schema)
The WMS introduces a dedicated schema namespace `warehouse` to isolate concerns while linking to global Master Data.

#### Core Entities
1.  **Warehouse**: Represents physical buildings (e.g., Distribution Center, Raw Material Store).
2.  **WarehouseLocation**: Hierarchical storage units.
    -   *Structure*: Zone -> Aisle -> Rack -> Shelf -> Bin.
    -   *Features*: Capacity constraints, Dimensions (LxWxH), Barcode support.
3.  **InventoryItem**: The "Quantum" of stock.
    -   Represents `Item + Location + Batch + Serial + Status`.
    -   *Status*: Available, Reserved, Quarantine, Damaged.

#### Operational Entities
1.  **StockMovement**: Immutable ledger of all inventory changes.
    -   *Types*: Inbound, Outbound, Transfer, Adjustment.
    -   *Audit*: Links to original documents (PO, SO).
2.  **TransferRequest**: Document for managing internal moves (Draft -> Approved -> Completed).

### 2.3 Backend Architecture (NestJS)
The [WarehouseModule](file:///d:/projects/speed-limit/nestjs_backend/src/warehouse/warehouse.module.ts#10-17) encapsulates all logic:

-   **WarehouseService**: Manages physical layout and bin generation.
-   **InventoryService**:
    -   Provides real-time stock levels (Aggregated vs Detailed).
    -   Handles Batch/Serial finding logic (FEFO/FIFO).
-   **StockMovementService**:
    -   **Transactional Integrity**: Uses `prisma.$transaction` to ensure [StockMovement](file:///d:/projects/speed-limit/nestjs_backend/src/warehouse/stock-movement.service.ts#20-120) creation and `InventoryItem` updates are atomic.
    -   **Validation**: Prevents negative stock (unless configured otherwise).

### 2.4 Frontend Architecture (Next.js)
Located at `/erp/warehouse`.

-   **Dashboard**: High-level KPIs (Value, pending moves).
-   **Inventory Explorer**: Drill-down view (Warehouse -> Location -> Item).
-   **Operations UI**:
    -   Scan-based receiving and picking.
    -   Drag-and-drop internal transfers (future scope).

## 3. Key Workflows

### 3.1 Inbound (Goods Receipt)
1.  User selects Purchase Order.
2.  System retrieves pending items.
3.  User scans item + inputs Batch/Expiry.
4.  User scans Target Bin (or System suggests based on Put-away rules).
5.  **Effect**: Increase `InventoryItem` at Location; Create [StockMovement](file:///d:/projects/speed-limit/nestjs_backend/src/warehouse/stock-movement.service.ts#20-120) (Type: INBOUND).

### 3.2 Outbound (Picking)
1.  User selects Sales Order.
2.  System generates **Pick List** based on FEFO (First Expiring First Out).
3.  Picker scans Source Bin and Item.
4.  **Effect**: Decrease `InventoryItem`; Create [StockMovement](file:///d:/projects/speed-limit/nestjs_backend/src/warehouse/stock-movement.service.ts#20-120) (Type: OUTBOUND).

### 3.3 Internal Transfer
1.  Ad-hoc move or Replenishment Trigger.
2.  Source Bin -> Target Bin.
3.  **Effect**: Atomic Debit/Credit pair in Inventory; Single [StockMovement](file:///d:/projects/speed-limit/nestjs_backend/src/warehouse/stock-movement.service.ts#20-120) (Type: TRANSFER) logging From/To keys.

## 4. Integration Points
-   **Finance Module**: Stock value changes trigger GL postings (Debit Inventory, Credit GR/IR).
-   **Procurement**: Updates PO status upon Receipt.
-   **Sales**: Updates SO status upon Dispatch.

## 5. Security & Multi-tenancy
-   All data is scoped by `tenantId` (implicit via connection) or Schema.
-   **RBAC**:
    -   `warehouse.read`: View stock.
    -   `warehouse.write`: Execute moves.
    -   `warehouse.admin`: Configure bins/layout.

## 6. Future Scalability
-   **Mobile App**: API is ready for handheld scanner integration.
-   **Robotics Interface**: [StockMovementService](file:///d:/projects/speed-limit/nestjs_backend/src/warehouse/stock-movement.service.ts#20-120) can be extended to publish events to ASRS/AGV systems.
