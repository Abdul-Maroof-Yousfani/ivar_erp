'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Check, X } from 'lucide-react';
import Link from 'next/link';
import { purchaseReturnApi, PurchaseReturn } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PermissionGuard } from "@/components/auth/permission-guard";

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const returnTypeLabels = {
  DEFECTIVE: 'Defective',
  EXCESS: 'Excess',
  WRONG_ITEM: 'Wrong Item',
  DAMAGED: 'Damaged',
};

export default function PurchaseReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadPurchaseReturn(params.id as string);
    }
  }, [params.id]);

  const loadPurchaseReturn = async (id: string) => {
    try {
      setLoading(true);
      const data = await purchaseReturnApi.getById(id);
      setPurchaseReturn(data);
    } catch (error) {
      console.error('Error loading purchase return:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!purchaseReturn) return;

    try {
      await purchaseReturnApi.updateStatus(purchaseReturn.id, status, 'current-user-id'); // Replace with actual user ID
      loadPurchaseReturn(purchaseReturn.id);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleSubmit = async () => {
    if (!purchaseReturn) return;
    
    if (confirm('Submit this return for approval?')) {
      await handleStatusUpdate('SUBMITTED');
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading purchase return...</div>;
  }

  if (!purchaseReturn) {
    return <div className="p-6 text-center text-red-500">Purchase return not found</div>;
  }

  return (
    <PermissionGuard permissions="erp.procurement.pret.read">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
          
            <div>
              <h1 className="text-2xl font-bold">Purchase Return {purchaseReturn.returnNumber}</h1>
              <p className="text-gray-600">Return details and status</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {purchaseReturn.status === 'DRAFT' && (
              <PermissionGuard permissions="erp.procurement.pret.update" fallback={null}>
                <>
                  <Link href={`/erp/procurement/purchase-returns/${purchaseReturn.id}/edit`}>
                    <Button variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  <Button onClick={handleSubmit}>
                    Submit for Approval
                  </Button>
                </>
              </PermissionGuard>
            )}
            {purchaseReturn.status === 'SUBMITTED' && (
              <PermissionGuard permissions="erp.procurement.pret.update" fallback={null}>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="text-green-600"
                    onClick={() => handleStatusUpdate('APPROVED')}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-red-600"
                    onClick={() => handleStatusUpdate('REJECTED')}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </PermissionGuard>
            )}
          </div>
        </div>

      {/* Return Header */}
      <Card>
        <CardHeader>
          <CardTitle>Return Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold text-gray-700">Return Details</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Return Number:</span>
                  <div className="font-medium">{purchaseReturn.returnNumber}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Source Type:</span>
                  <div>
                    <Badge variant="outline">
                      {purchaseReturn.sourceType === 'GRN' ? 'GRN' : 'Landed Cost'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Return Type:</span>
                  <div className="font-medium">{returnTypeLabels[purchaseReturn.returnType]}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Status:</span>
                  <div>
                    <Badge className={statusColors[purchaseReturn.status]}>
                      {purchaseReturn.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700">Supplier & Warehouse</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Supplier:</span>
                  <div className="font-medium">{purchaseReturn.supplier?.name || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Warehouse:</span>
                  <div className="font-medium">{purchaseReturn.warehouse?.name || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Return Date:</span>
                  <div className="font-medium">{formatDate(purchaseReturn.returnDate)}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700">Financial Summary</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Subtotal:</span>
                  <div className="font-medium">{formatCurrency(purchaseReturn.subtotal)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tax Amount:</span>
                  <div className="font-medium">{formatCurrency(purchaseReturn.taxAmount)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Amount:</span>
                  <div className="font-bold text-lg">{formatCurrency(purchaseReturn.totalAmount)}</div>
                </div>
              </div>
            </div>
          </div>

          {purchaseReturn.reason && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-700">Return Reason</h3>
              <p className="mt-2 text-gray-600">{purchaseReturn.reason}</p>
            </div>
          )}

          {purchaseReturn.notes && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-700">Notes</h3>
              <p className="mt-2 text-gray-600">{purchaseReturn.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return Items */}
      <Card>
        <CardHeader>
          <CardTitle>Return Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Item</th>
                  <th className="text-left p-3">Return Qty</th>
                  <th className="text-left p-3">Unit Price</th>
                  <th className="text-left p-3">Line Total</th>
                  <th className="text-left p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {purchaseReturn.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{item.description}</div>
                        <div className="text-sm text-gray-500">{item.item?.itemId || item.itemId}</div>
                      </div>
                    </td>
                    <td className="p-3">{item.returnQty}</td>
                    <td className="p-3">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3">{formatCurrency(item.lineTotal)}</td>
                    <td className="p-3">{item.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Source Document Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Source Document</CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseReturn.sourceType === 'GRN' && purchaseReturn.grn && (
            <div>
              <h3 className="font-semibold">GRN Reference</h3>
              <p className="text-gray-600">GRN Number: {purchaseReturn.grn.grnNumber}</p>
              <p className="text-gray-600">PO Number: {purchaseReturn.grn.purchaseOrder?.poNumber}</p>
            </div>
          )}
          {purchaseReturn.sourceType === 'LANDED_COST' && purchaseReturn.landedCost && (
            <div>
              <h3 className="font-semibold">Landed Cost Reference</h3>
              <p className="text-gray-600">LC Number: {purchaseReturn.landedCost.landedCostNumber}</p>
              <p className="text-gray-600">PO Number: {purchaseReturn.landedCost.purchaseOrder?.poNumber}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Information */}
      {purchaseReturn.status === 'APPROVED' && purchaseReturn.approvedBy && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Approval & Financial Impact</CardTitle>
            {purchaseReturn.debitNote && (
              <Link href={`/erp/procurement/debit-notes/${purchaseReturn.debitNote.id}`}>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  View Debit Note
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Approved By:</span>
                <div className="font-medium">{purchaseReturn.approvedBy}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Approved At:</span>
                <div className="font-medium">{formatDate(purchaseReturn.approvedAt!)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </PermissionGuard>
  );
}