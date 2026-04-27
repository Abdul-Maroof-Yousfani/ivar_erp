Here's a complete module-by-module breakdown of every page we've protected, with the permissions used:

---

## Master Module
| Page | Permission |
|------|-----------|
| `master/location/list/page.tsx` (list) | `master.location.read` |
| `master/location/list/location-list.tsx` | create/update/delete |
| `master/location/list/columns.tsx` (row actions) | update/delete/pos.read |
| `master/location/list/pos-management-modal.tsx` | `master.pos.create`, `master.pos.update` |

---

## ERP Dashboard
| Page | Permission |
|------|-----------|
| `erp/page.tsx` | `erp.dashboard.view` |
| Overview tab | `erp.dashboard.overview.view` |
| Export button | `erp.dashboard.overview.export` |
| Analytics tab | `erp.dashboard.analytics.view` |
| Inventory tab | `erp.dashboard.inventory.view` |
| Refresh button | `erp.dashboard.inventory.refresh` |

---

## ERP Inventory
| Page | Permission |
|------|-----------|
| `erp/inventory/page.tsx` | `erp.inventory.view` |
| Explorer button | `erp.inventory.explorer.view` |
| Transfer Stock button | `erp.inventory.transfer.create` |
| `erp/inventory/explorer/page.tsx` | `erp.inventory.explorer.view` |
| Export PDF button | `erp.inventory.explorer.export` |
| `erp/inventory/warehouse/page.tsx` | `erp.inventory.warehouse.view` |
| `erp/inventory/warehouse/add/page.tsx` | `erp.inventory.warehouse.view` + create/update/delete |
| `erp/inventory/warehouse/edit/[id]/page.tsx` | `erp.inventory.warehouse.update` |
| `erp/inventory/warehouse/inventory/page.tsx` | `erp.inventory.warehouse.inventory.view` |

---

## ERP Items
| Page | Permission |
|------|-----------|
| `erp/items/list/page.tsx` | `erp.item.read` |
| `erp/items/list/item-list.tsx` | create/update/delete/bulk-upload |
| `erp/items/create/page.tsx` | `erp.item.create` |
| `erp/items/edit/[id]/page.tsx` | `erp.item.update` |
| `erp/items/view/[id]/page.tsx` | `erp.item.read` (server redirect) |

---

## ERP Finance
| Page | Permission |
|------|-----------|
| `erp/finance/journal-voucher/list/page.tsx` | `erp.finance.journal-voucher.*` (server) |
| `erp/finance/journal-voucher/create/page.tsx` | `erp.finance.journal-voucher.create` (server redirect) |
| `erp/finance/payment-voucher/list/page.tsx` | `erp.finance.payment-voucher.*` (server) |
| `erp/finance/payment-voucher/create/page.tsx` | `erp.finance.payment-voucher.create` (server redirect) |
| `erp/finance/receipt-voucher/list/page.tsx` | `erp.finance.receipt-voucher.*` (server) |
| `erp/finance/receipt-voucher/create/page.tsx` | `erp.finance.receipt-voucher.create` (server redirect) |

---

## ERP Procurement — Purchase Requisition
| Page | Permission |
|------|-----------|
| `procurement/purchase-requisition/page.tsx` | `erp.procurement.pr.read` (server redirect) |
| Create PR button | `erp.procurement.pr.create` |
| `procurement/purchase-requisition/create/page.tsx` | `erp.procurement.pr.create` |
| `procurement/purchase-requisition/[id]/page.tsx` | — |
| Submit button | `erp.procurement.pr.submit` |
| Approve/Reject buttons | `erp.procurement.pr.approve` |

---

## ERP Procurement — RFQ
| Page | Permission |
|------|-----------|
| `procurement/rfq/page.tsx` | `erp.procurement.rfq.read` |
| Create RFQ button | `erp.procurement.rfq.create` |
| `procurement/rfq/create/page.tsx` | `erp.procurement.rfq.create` |
| `procurement/rfq/[id]/page.tsx` | `erp.procurement.rfq.read` (server redirect) |
| Add Vendors button | `erp.procurement.rfq.add-vendors` |
| Mark as Sent button | `erp.procurement.rfq.send` |

---

## ERP Procurement — Vendor Quotation
| Page | Permission |
|------|-----------|
| `procurement/vendor-quotation/list/page.tsx` | `erp.procurement.vq.read` |
| Create Quotation button | `erp.procurement.vq.create` |
| Submit inline button | `erp.procurement.vq.submit` |
| Compare All button | `erp.procurement.vq.compare` |
| `procurement/vendor-quotation/create/page.tsx` | `erp.procurement.vq.create` |
| `procurement/vendor-quotation/[id]/page.tsx` | `erp.procurement.vq.read` |
| Submit/Select/Generate PO buttons | submit/select/`erp.procurement.po.create` |
| `procurement/vendor-quotation/compare/[rfqId]/page.tsx` | `erp.procurement.vq.compare` |
| Select This Vendor button | `erp.procurement.vq.select` |
| Award & Create POs button | `erp.procurement.po.create` |

---

## ERP Procurement — Purchase Order
| Page | Permission |
|------|-----------|
| `procurement/purchase-order/page.tsx` | `erp.procurement.po.read` |
| Create Direct PO / From Quotations buttons | `erp.procurement.po.create` |
| `procurement/purchase-order/create/page.tsx` | `erp.procurement.po.create` |
| `procurement/purchase-order/[id]/page.tsx` | — |
| Create GRN button | `erp.procurement.grn.create` |
| `procurement/purchase-order/pending/page.tsx` | `erp.procurement.po.create` |

---

## ERP Procurement — GRN
| Page | Permission |
|------|-----------|
| `procurement/grn/page.tsx` | `erp.procurement.grn.read` |
| Create GRN dialog | `erp.procurement.grn.create` |
| `procurement/grn/[id]/page.tsx` | `erp.procurement.grn.read` |
| `procurement/grn/create/[poId]/page.tsx` | `erp.procurement.grn.create` |

---

## ERP Procurement — Landed Cost
| Page | Permission |
|------|-----------|
| `procurement/landed-cost/page.tsx` | `erp.procurement.landed-cost.read` |
| Post Landed Cost button | `erp.procurement.landed-cost.create` |
| `procurement/landed-cost/local/page.tsx` | `erp.procurement.landed-cost.create` |
| `procurement/landed-cost/setup/page.tsx` | `erp.procurement.landed-cost.create` |
| `procurement/landed-cost/post/[grnId]/page.tsx` | `erp.procurement.landed-cost.create` |
| `procurement/landed-cost/report/page.tsx` | `erp.procurement.landed-cost.read` |

---

## ERP Procurement — Purchase Invoice
| Page | Permission |
|------|-----------|
| `procurement/purchase-invoice/page.tsx` | `erp.procurement.pi.read` |
| Create Invoice / Direct PI buttons | `erp.procurement.pi.create` |
| Edit button | `erp.procurement.pi.update` |
| Delete button | `erp.procurement.pi.delete` |
| `procurement/purchase-invoice/[id]/page.tsx` | `erp.procurement.pi.read` |
| Approve button | `erp.procurement.pi.post` |
| Create Payment button | `erp.finance.payment-voucher.create` |
| `procurement/purchase-invoice/create/page.tsx` | `erp.procurement.pi.create` |
| `procurement/purchase-invoice/create-direct/page.tsx` | `erp.procurement.pi.create` |

---

## ERP Procurement — Purchase Returns
| Page | Permission |
|------|-----------|
| `procurement/purchase-returns/page.tsx` | `erp.procurement.pret.read` |
| Create Return button | `erp.procurement.pret.create` |
| Edit / Approve / Reject buttons | `erp.procurement.pret.update` |
| Delete button | `erp.procurement.pret.delete` |
| `procurement/purchase-returns/[id]/page.tsx` | `erp.procurement.pret.read` |
| Edit / Submit / Approve / Reject buttons | `erp.procurement.pret.update` |
| `procurement/purchase-returns/create/page.tsx` | `erp.procurement.pret.create` |

---

## ERP Procurement — Debit Notes
| Page | Permission |
|------|-----------|
| `procurement/debit-notes/page.tsx` | `erp.procurement.dn.read` |
| `procurement/debit-notes/[id]/page.tsx` | `erp.procurement.dn.read` |

---

## ERP Procurement — Vendors
| Page | Permission |
|------|-----------|
| `procurement/vendors/page.tsx` (Form) | `erp.procurement.vendor.create` |
| `procurement/vendors/list/page.tsx` | `erp.procurement.vendor.read` |
| View Details button | `erp.procurement.vendor.read` |
| Edit button | `erp.procurement.vendor.update` |
| `procurement/vendors/view/[id]/page.tsx` | `erp.procurement.vendor.read` |
| `procurement/vendors/edit/[id]/page.tsx` | `erp.procurement.vendor.update` |

---

## ERP Claims
| Page | Permission |
|------|-----------|
| `erp/claims/page.tsx` | `erp.claims.read` |
| Start Review button | `erp.claims.approve` |
| Submit Decision button | `erp.claims.approve` |

---

## ERP Inventory Transactions
| Page | Permission |
|------|-----------|
| `erp/inventory/transactions/stock-transfer/page.tsx` | `erp.inventory.transfer.create` |
| `erp/inventory/transactions/stock-transfer/history/page.tsx` | `erp.inventory.stock-transfer.read` |
| `erp/inventory/transactions/stock-transfer/slip/[id]/page.tsx` | `erp.inventory.stock-transfer.read` |
| `erp/inventory/transactions/delivery-note/page.tsx` | `erp.inventory.delivery-note.read` |
| `erp/inventory/transactions/stock-received/page.tsx` | `erp.inventory.stock-received.read` |
| `erp/inventory/transactions/return-transfer/page.tsx` | `erp.inventory.return-transfer.create` |

---

## POS Inventory
| Page | Permission |
|------|-----------|
| `pos/inventory/view/page.tsx` | `pos.inventory.view` (PermissionGuard wrapper) |
| `pos/inventory/receiving/page.tsx` | Accept button → `pos.inventory.receiving.accept` |
| `pos/inventory/returns/page.tsx` | Approve Return button → `pos.inventory.returns.approve` |
| `pos/inventory/inbound/page.tsx` | Accept Transfer button → `pos.inventory.inbound.accept` |
| `pos/inventory/outbound/page.tsx` | Approve & Release button → `pos.inventory.outbound.approve` |
| `pos/inventory/receipt/page.tsx` | Print button → `pos.inventory.receipt.view` |

---

## POS — Dashboard
| Page | Permission |
|------|-----------|
| `pos/page.tsx` | `pos.dashboard.view` (PermissionGuard wrapper) |

---

## POS — New Sale
| Page / Action | Permission |
|------|-----------|
| `pos/new-sale/page.tsx` | Cart discount input (per-item) → `pos.sale.item-discount` |
| Transit override toggle | `pos.sale.transit-override` |
| Hold button (F8 / footer) | `pos.hold.create` |
| View hold orders dialog | `pos.hold.view` |
| Resume hold button | `pos.hold.resume` |

---

## POS — Checkout
| Page / Action | Permission |
|------|-----------|
| `pos/checkout/page.tsx` | Promo campaigns section → `pos.checkout.promo` |
| Coupon / Voucher section | `pos.checkout.coupon` |
| Alliance / Bank Card section | `pos.checkout.alliance` |
| Manual Discount section | `pos.checkout.manual-discount` |
| Add New Customer button | `pos.checkout.add-customer` |
| Hold from checkout | `pos.hold.create` |

---

## POS — Hold Orders
| Page | Permission |
|------|-----------|
| `pos/holds/page.tsx` | `pos.hold.view` (PermissionGuard wrapper) |
| Resume button | `pos.hold.resume` |

---

## POS — Sales History
| Page / Action | Permission |
|------|-----------|
| `pos/sales/history/page.tsx` | `pos.sales.history.view` (existing on GET /orders) |
| Print receipt button | `pos.sales.history.print` |
| Update tender button | `pos.sales.history.update-tender` |
| Resume hold button | `pos.hold.resume` |

---

## POS — Returns / Exchanges / Claims
| Page / Action | Permission |
|------|-----------|
| `pos/sales/returns/page.tsx` | Return tab + submit → `pos.return.create` |
| Exchange tab + submit | `pos.exchange.create` |
| Claim tab + submit | `pos.claim.create` |

---

## POS — Customers
| Page / Action | Permission |
|------|-----------|
| `pos/customers/page.tsx` | Add Customer button → `pos.customer.create` |
| Edit button (sheet) | `pos.customer.update` |

---

## POS — Customer Ledger
| Page / Action | Permission |
|------|-----------|
| `pos/customer-ledger/page.tsx` | Receive Payment button → `pos.ledger.payment` |
| Record Payment (modal) | `pos.ledger.payment` |
| Change credit limit link | `pos.ledger.credit-limit` |

---

## POS — Vouchers
| Page / Action | Permission |
|------|-----------|
| `pos/vouchers/page.tsx` | Issue Voucher button → `pos.voucher.create` |
| Void button | `pos.voucher.void` |
| Delete button | `pos.voucher.delete` |

---

## POS — Shifts / Cash Drawer
| Page / Action | Permission |
|------|-----------|
| `pos/shifts/page.tsx` | Open Shift button → `pos.shift.open` |
| Close Shift button | `pos.shift.close` |

---

## POS — Terminal
| Page | Permission |
|------|-----------|
| `pos/terminal/settings/page.tsx` | `pos.terminal.settings` (PermissionGuard wrapper) |
| `pos/terminal/logout/page.tsx` | `pos.terminal.logout` (PermissionGuard wrapper) |

---

## Backend Controllers Protected
`purchase-requisition`, `rfq`, `vendor-quotation`, `purchase-order`, `grn`, `landed-cost`, `purchase-invoice`, `purchase-returns`, `debit-notes`, `claims`, `stock-transfer`, `delivery-note`, `stock-received`, `return-transfer`, `journal-voucher`, `payment-voucher`, `receipt-voucher`, `transfer-request`, `stock-operation`, `pos-sales` (create, return, exchange, hold, resume, list-holds), `pos-config` (vouchers CRUD), `pos-session` (open/close shift) — all have `@UseGuards(JwtAuthGuard, PermissionsGuard)` with `@Permissions(...)` on every route.

---

## Permissions Added (4/22/2026 — POS Full Module)
| Permission | Description |
|-----------|-------------|
| `pos.inventory.view` | View POS Inventory Stock |
| `pos.inventory.receiving.view` | View POS Stock Receiving (Warehouse → Outlet) |
| `pos.inventory.receiving.accept` | Accept Incoming Stock from Warehouse |
| `pos.inventory.returns.view` | View POS Return Requests (Outlet → Warehouse) |
| `pos.inventory.returns.approve` | Approve Return Requests to Warehouse |
| `pos.inventory.inbound.view` | View POS Inbound Transfers (Outlet → Outlet) |
| `pos.inventory.inbound.accept` | Accept Inbound Outlet-to-Outlet Transfers |
| `pos.inventory.outbound.view` | View POS Outbound Transfer Requests |
| `pos.inventory.outbound.approve` | Approve Outbound Outlet-to-Outlet Transfers |
| `pos.inventory.receipt.view` | View POS Stock Receipts & Print Slips |
| `pos.inventory.transfer.create` | Create Transfer Request from POS |
| `pos.stock.move` | Execute Direct Stock Movement |
| `pos.sale.create` | Create a New POS Sale |
| `pos.sale.item-discount` | Apply Per-Item Discount Override on Cart |
| `pos.sale.transit-override` | Mark Items as Stock-in-Transit |
| `pos.checkout.promo` | Apply Promo Campaign Discount at Checkout |
| `pos.checkout.coupon` | Apply Coupon / Voucher Code at Checkout |
| `pos.checkout.alliance` | Apply Alliance / Bank Card Discount at Checkout |
| `pos.checkout.manual-discount` | Apply Manual Order-Level Discount at Checkout |
| `pos.checkout.add-customer` | Add New Customer During Checkout |
| `pos.hold.create` | Place a Cart on Hold |
| `pos.hold.resume` | Resume a Held Order |
| `pos.hold.view` | View Hold Orders List |
| `pos.sales.history.view` | View POS Sales History |
| `pos.sales.history.print` | Print Receipt from Sales History |
| `pos.sales.history.update-tender` | Update Payment Tender on Completed Order |
| `pos.return.create` | Process a Return / Refund |
| `pos.exchange.create` | Process an Exchange |
| `pos.claim.create` | Submit a Claim to ERP |
| `pos.customer.view` | View POS Customer List |
| `pos.customer.create` | Create a New POS Customer |
| `pos.customer.update` | Edit an Existing POS Customer |
| `pos.ledger.view` | View Customer Credit Ledger |
| `pos.ledger.payment` | Record Customer Credit Payment |
| `pos.ledger.credit-limit` | Set / Change Customer Credit Limit |
| `pos.voucher.view` | View Issued Vouchers |
| `pos.voucher.create` | Issue a New Voucher |
| `pos.voucher.void` | Void / Deactivate a Voucher |
| `pos.voucher.delete` | Delete an Unused Voucher |
| `pos.shift.view` | View Shift History |
| `pos.shift.open` | Open a New Shift |
| `pos.shift.close` | Close the Current Shift |
| `pos.terminal.settings` | Access & Save Terminal Settings |
| `pos.terminal.logout` | Deregister / Logout Terminal |
| `pos.dashboard.view` | View POS Dashboard & Stats |