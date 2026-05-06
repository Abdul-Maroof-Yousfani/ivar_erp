# Purchase Return System Documentation

## Overview
Purchase Return system allows returning goods to suppliers after receiving them through GRN or Landed Cost processes. The system handles both inventory and financial impacts based on different scenarios.

## Business Flow

### Purchase Return Process Flow
```
PO → GRN/Landed Cost → [Purchase Invoice] → Purchase Return → Approval → Impact
```

## Scenarios

### Case 1: Pre-Invoice Return
**Flow**: `GRN/Landed Cost → Purchase Return`

**When**: Items returned before creating purchase invoice

**Impact**:
- ✅ **Inventory**: Stock quantity reduced
- ✅ **Stock Ledger**: Negative outbound entries
- ❌ **Financial**: No immediate financial impact
- 📋 **Future**: Returned items excluded from future invoices

**Example**:
```
Received: 100 items via GRN
Returned: 10 items (before invoice)
Available for Invoice: 90 items
```

### Case 2: Post-Invoice Return (Unpaid)
**Flow**: `GRN/Landed Cost → Purchase Invoice → Purchase Return`

**When**: Items returned after invoice created but before payment

**Impact**:
- ✅ **Inventory**: Stock quantity reduced
- ✅ **Stock Ledger**: Negative outbound entries
- ✅ **Financial**: Invoice amount adjusted
- ✅ **Accounts Payable**: Outstanding amount reduced
- 📋 **Supplier**: Credit note generated

**Example**:
```
Original Invoice: PKR 100,000
Return Amount: PKR 15,000
New Outstanding: PKR 85,000
```

### Case 3: Post-Payment Return (Future Enhancement)
**Flow**: `GRN/Landed Cost → Purchase Invoice → Payment → Purchase Return`

**When**: Items returned after payment made

**Impact**:
- ✅ **Inventory**: Stock quantity reduced
- ✅ **Financial**: Supplier credit balance created
- 📋 **Refund**: Request refund from supplier

## Database Schema

### Purchase Return Table
```sql
purchase_returns:
- id (UUID)
- return_number (unique)
- source_type (GRN/LANDED_COST)
- grn_id / landed_cost_id
- supplier_id
- warehouse_id
- return_date
- return_type (DEFECTIVE/EXCESS/WRONG_ITEM/DAMAGED)
- reason
- status (DRAFT/SUBMITTED/APPROVED/REJECTED)
- subtotal, tax_amount, total_amount
- approved_by, approved_at
```

### Purchase Return Items Table
```sql
purchase_return_items:
- id (UUID)
- purchase_return_id
- source_item_type (GRN_ITEM/LANDED_COST_ITEM)
- grn_item_id / landed_cost_item_id
- item_id
- return_qty
- unit_price
- line_total
- reason
```

## API Endpoints

### Purchase Return Management
```typescript
GET    /api/purchase/purchase-returns              // List all returns
POST   /api/purchase/purchase-returns              // Create new return
GET    /api/purchase/purchase-returns/:id          // Get return details
PATCH  /api/purchase/purchase-returns/:id          // Update return
DELETE /api/purchase/purchase-returns/:id          // Delete return (DRAFT only)
PATCH  /api/purchase/purchase-returns/:id/status   // Update status
```

### Helper Endpoints
```typescript
GET /api/purchase/purchase-returns/eligible-grns         // Get eligible GRNs
GET /api/purchase/purchase-returns/eligible-landed-costs // Get eligible Landed Costs
```

## Status Workflow

### Status Transitions
```
DRAFT → SUBMITTED → APPROVED/REJECTED
```

### Status Rules
- **DRAFT**: Can be edited/deleted
- **SUBMITTED**: Awaiting approval, cannot be modified
- **APPROVED**: Inventory and financial impact processed
- **REJECTED**: No impact, return cancelled

### Permissions
- **Create/Edit**: Purchase staff
- **Submit**: Purchase staff
- **Approve/Reject**: Purchase manager/admin

## Implementation Details

### Current Implementation (✅ Working)

#### 1. Basic Return Flow
```typescript
// Create return
const return = await purchaseReturnApi.create({
  sourceType: 'GRN',
  grnId: 'grn-uuid',
  supplierId: 'supplier-uuid',
  warehouseId: 'warehouse-uuid',
  returnType: 'DEFECTIVE',
  reason: 'Items damaged during shipping',
  items: [...]
});

// Approve return
await purchaseReturnApi.updateStatus(returnId, 'APPROVED', userId);
```

#### 2. Inventory Impact
```typescript
// Stock ledger entries (negative for returns)
{
  itemId: 'item-uuid',
  warehouseId: 'warehouse-uuid',
  qty: -5.0000,                    // Negative quantity
  movementType: 'OUTBOUND',
  referenceType: 'PURCHASE_RETURN_GRN',
  referenceId: 'return-uuid'
}

// Inventory items update
UPDATE inventory_items 
SET quantity = quantity - return_qty 
WHERE item_id = ? AND warehouse_id = ?
```

#### 3. Financial Integration (Case 2)
When a return is approved after an invoice is created:
1.  **Debit Note**: A formal document is generated to adjust the supplier balance.
2.  **Invoice Update**: The `returnAmount` is incremented, and `remainingAmount` is decremented.
3.  **Audit Integrity**: The original `totalAmount` remains unchanged.

```typescript
// processFinancialAdjustment in PurchaseReturnService
const debitNote = await this.prisma.debitNote.create({
  data: {
    debitNoteNo: `DN-${Date.now()}`,
    amount: returnAmount,
    purchaseReturnId: return.id,
    purchaseInvoiceId: invoice.id,
    supplierId: return.supplierId,
    status: 'APPROVED',
  }
});

await this.prisma.purchaseInvoice.update({
  where: { id: invoice.id },
  data: {
    returnAmount: { increment: returnAmount },
    remainingAmount: { decrement: returnAmount },
  }
});
```

#### 4. Validation Rules
- Only VALUED GRNs can be returned
- Only SUBMITTED Landed Costs can be returned
- Return quantity cannot exceed received quantity
- Items must exist in system
- Warehouse must be valid

### Planned Implementation (🔄 In Progress)

#### 1. Case 3: Post-Payment Return
Handling returns after full payment has been made, involving supplier credits or cash refunds.

## Frontend Implementation

### Pages Structure
```
/erp/procurement/purchase-returns/
├── page.tsx                    // List all returns
├── create/page.tsx            // Create new return
├── [id]/page.tsx             // View return details
└── [id]/edit/page.tsx        // Edit return (DRAFT only)
```

### Key Components
- **Return List**: Filter by status, supplier, date range
- **Create Form**: Select GRN/Landed Cost, choose items
- **Item Selection**: Show available quantities, validate return qty
- **Status Actions**: Submit, Approve, Reject buttons
- **Detail View**: Complete return information with audit trail

### User Experience
1. **Create Return**: Select source document → Choose items → Set quantities → Submit
2. **Approval**: Manager reviews → Approves/Rejects → System processes impact
3. **Tracking**: View all returns with status, amounts, dates

## Testing Scenarios

### Test Case 1: Basic Return Flow
```
1. Create GRN with 100 items
2. Create purchase return for 10 items
3. Submit return
4. Approve return
5. Verify inventory reduced by 10
6. Verify stock ledger has negative entry
```

### Test Case 2: Invoice Impact
```
1. Create GRN with 100 items
2. Create purchase invoice for all items
3. Create purchase return for 10 items
4. Approve return
5. Verify invoice outstanding reduced
6. Verify supplier credit created
```

### Test Case 3: Validation
```
1. Try returning more than received quantity → Should fail
2. Try returning from non-VALUED GRN → Should fail
3. Try editing APPROVED return → Should fail
4. Try deleting SUBMITTED return → Should fail
```

## Error Handling

### Common Errors
- **Item not found**: Item code doesn't exist in system
- **Warehouse not found**: Invalid warehouse ID
- **Insufficient quantity**: Return qty > available qty
- **Invalid status**: Cannot return from non-VALUED GRN
- **Permission denied**: User lacks approval permissions

### Error Messages
```typescript
{
  "status": false,
  "message": "Item with code 104600 does not exist",
  "statusCode": 400
}
```

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields
- Efficient joins for return listing
- Batch processing for multiple items

### Caching Strategy
- Cache eligible GRNs/Landed Costs
- Cache item information
- Invalidate cache on status changes

## Security & Permissions

### Access Control
- **View**: All purchase staff
- **Create/Edit**: Purchase staff with create permissions
- **Approve**: Purchase managers only
- **Delete**: Purchase staff (DRAFT only)

### Audit Trail
- All status changes logged with user and timestamp
- Item-level tracking for return reasons
- Complete history maintained

## Integration Points

### Upstream Systems
- **Purchase Orders**: Source of original purchase
- **GRN System**: Source documents for returns
- **Landed Cost**: Alternative source for returns

### Downstream Systems
- **Inventory Management**: Stock quantity updates
- **Financial System**: Invoice adjustments
- **Supplier Management**: Credit notes and balances
- **Reporting**: Return analytics and trends

## Future Enhancements

### Phase 2 Features
- **Partial Returns**: Multiple returns against same GRN
- **Return Tracking**: Physical return status to supplier
- **Quality Control**: Integration with QC rejection reasons
- **Automated Returns**: Auto-return based on QC failures

### Phase 3 Features
- **Return Analytics**: Supplier return rate analysis
- **Cost Impact**: Return cost allocation and tracking
- **Supplier Portal**: Allow suppliers to view return status
- **Mobile App**: Mobile return processing for warehouse staff

## Troubleshooting

### Common Issues
1. **Stock not updating**: Check inventory items table update logic
2. **Financial impact missing**: Verify invoice detection logic
3. **Permission errors**: Check user role assignments
4. **Validation failures**: Verify source document status

### Debug Steps
1. Check backend logs for detailed error messages
2. Verify database constraints and foreign keys
3. Test API endpoints individually
4. Validate frontend form data before submission

## Conclusion

The Purchase Return system provides comprehensive functionality for handling returned goods with proper inventory and financial impact. The modular design allows for easy extension and integration with other ERP modules.

Key benefits:
- ✅ Complete audit trail with original invoice amounts preserved
- ✅ Automated Debit Note generation for financial transparency
- ✅ Clear visibility of returns in Payment Vouchers and Invoices
- ✅ Automated inventory adjustments
- ✅ User-friendly interface with print functionality for Debit Notes
- ✅ Robust validation and error handling