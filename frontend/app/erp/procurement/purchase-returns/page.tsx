'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { purchaseReturnApi, PurchaseReturn } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
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

export default function PurchaseReturnsPage() {
  const { user } = useAuth(); // Get current logged-in user
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadReturns();
  }, [statusFilter]);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const data = await purchaseReturnApi.list({ 
        status: statusFilter === 'ALL' ? undefined : statusFilter 
      });
      setReturns(data);
    } catch (error) {
      console.error('Error loading purchase returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this purchase return?')) {
      try {
        await purchaseReturnApi.delete(id);
        loadReturns();
      } catch (error) {
        console.error('Error deleting purchase return:', error);
      }
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      // Use actual logged-in user's ID for approval
      const approvedBy = status === 'APPROVED' ? user?.id : undefined;
      await purchaseReturnApi.updateStatus(id, status, approvedBy);
      loadReturns();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading purchase returns...</div>;
  }

  return (
    <PermissionGuard permissions="erp.procurement.pret.read">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Purchase Returns</h1>
            <p className="text-gray-600">Manage purchase returns and refunds</p>
          </div>
          <PermissionGuard permissions="erp.procurement.pret.create" fallback={null}>
            <Link href="/erp/procurement/purchase-returns/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Return
              </Button>
            </Link>
          </PermissionGuard>
        </div>

        {/* Status Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              {['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Returns List */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Returns ({returns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {returns.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No purchase returns found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Return #</th>
                      <th className="text-left p-3">Source</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((returnItem) => (
                      <tr key={returnItem.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{returnItem.returnNumber}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {returnItem.sourceType === 'GRN' ? 'GRN' : 'Landed Cost'}
                          </Badge>
                        </td>
                        <td className="p-3">{returnItem.supplier?.name || 'N/A'}</td>
                        <td className="p-3">{returnTypeLabels[returnItem.returnType]}</td>
                        <td className="p-3">{formatCurrency(returnItem.totalAmount)}</td>
                        <td className="p-3">
                          <Badge className={statusColors[returnItem.status]}>
                            {returnItem.status}
                          </Badge>
                        </td>
                        <td className="p-3">{formatDate(returnItem.returnDate)}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Link href={`/erp/procurement/purchase-returns/${returnItem.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            {returnItem.status === 'DRAFT' && (
                              <>
                                <PermissionGuard permissions="erp.procurement.pret.update" fallback={null}>
                                  <Link href={`/erp/procurement/purchase-returns/${returnItem.id}/edit`}>
                                    <Button size="sm" variant="outline">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                </PermissionGuard>
                                <PermissionGuard permissions="erp.procurement.pret.delete" fallback={null}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(returnItem.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </PermissionGuard>
                              </>
                            )}
                            {returnItem.status === 'SUBMITTED' && (
                              <PermissionGuard permissions="erp.procurement.pret.update" fallback={null}>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600"
                                    onClick={() => handleStatusUpdate(returnItem.id, 'APPROVED')}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600"
                                    onClick={() => handleStatusUpdate(returnItem.id, 'REJECTED')}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </PermissionGuard>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}