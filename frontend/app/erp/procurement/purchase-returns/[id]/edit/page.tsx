'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { purchaseReturnApi, PurchaseReturn, UpdatePurchaseReturnDto } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function EditPurchaseReturnPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(null);
  
  const [formData, setFormData] = useState<UpdatePurchaseReturnDto>({
    returnType: 'DEFECTIVE',
    reason: '',
    notes: '',
    items: [],
  });

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
      
      // Populate form data
      setFormData({
        returnType: data.returnType,
        reason: data.reason || '',
        notes: data.notes || '',
        items: data.items.map(item => ({
          sourceItemType: item.sourceItemType,
          grnItemId: item.grnItemId,
          landedCostItemId: item.landedCostItemId,
          itemId: item.itemId,
          description: item.description,
          returnQty: item.returnQty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          reason: item.reason,
        })),
      });
    } catch (error) {
      console.error('Error loading purchase return:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.items!];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'returnQty') {
      updatedItems[index].lineTotal = value * updatedItems[index].unitPrice;
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items!.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const calculateTotal = () => {
    return formData.items?.reduce((sum, item) => sum + item.lineTotal, 0) || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!purchaseReturn) return;

    // Validate items have return quantities
    const validItems = formData.items?.filter(item => item.returnQty > 0) || [];
    if (validItems.length === 0) {
      alert('Please specify return quantities for at least one item');
      return;
    }

    try {
      setLoading(true);
      await purchaseReturnApi.update(purchaseReturn.id, {
        ...formData,
        items: validItems,
      });
      router.push('/erp/procurement/purchase-returns');
    } catch (error) {
      console.error('Error updating purchase return:', error);
      alert('Error updating purchase return');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !purchaseReturn) {
    return <div className="p-6 text-center">Loading purchase return...</div>;
  }

  if (!purchaseReturn) {
    return <div className="p-6 text-center text-red-500">Purchase return not found</div>;
  }

  if (purchaseReturn.status !== 'DRAFT') {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">This purchase return cannot be edited</div>
        <Link href={`/erp/procurement/purchase-returns/${purchaseReturn.id}`}>
          <Button>View Return</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/erp/procurement/purchase-returns/${purchaseReturn.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Purchase Return {purchaseReturn.returnNumber}</h1>
          <p className="text-gray-600">Modify return details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Return Details */}
        <Card>
          <CardHeader>
            <CardTitle>Return Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Return Type</Label>
                <Select 
                  value={formData.returnType} 
                  onValueChange={(value: any) => setFormData({ ...formData, returnType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEFECTIVE">Defective</SelectItem>
                    <SelectItem value="EXCESS">Excess</SelectItem>
                    <SelectItem value="WRONG_ITEM">Wrong Item</SelectItem>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Source Type</Label>
                <Input 
                  value={purchaseReturn.sourceType === 'GRN' ? 'GRN' : 'Landed Cost'} 
                  disabled 
                />
              </div>
            </div>

            <div>
              <Label>Return Reason</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Explain the reason for return..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
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
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items?.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{item.description}</div>
                          <div className="text-sm text-gray-500">{item.itemId}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.returnQty}
                          onChange={(e) => handleItemChange(index, 'returnQty', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </td>
                      <td className="p-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3">{formatCurrency(item.lineTotal)}</td>
                      <td className="p-3">
                        <Input
                          value={item.reason || ''}
                          onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                          placeholder="Item reason..."
                          className="w-32"
                        />
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="text-lg font-semibold">
                Total: {formatCurrency(calculateTotal())}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes or comments..."
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href={`/erp/procurement/purchase-returns/${purchaseReturn.id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Return'}
          </Button>
        </div>
      </form>
    </div>
  );
}