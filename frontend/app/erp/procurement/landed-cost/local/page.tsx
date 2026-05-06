'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Grn } from '@/lib/api';
import { getGrns } from '@/lib/actions/grn';
import { createLocalLandedCost } from '@/lib/actions/landed-cost';
import { Label } from '@/components/ui/label';
import { Save, ArrowLeft } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/permission-guard';

interface LocalLandedCostItem {
  itemId: string;
  itemName: string;
  description: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
}

export default function LocalLandedCostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  // Data State
  const [grns, setGrns] = useState<Grn[]>([]);
  const [selectedGrn, setSelectedGrn] = useState<Grn | null>(null);

  // Form State
  const [grnId, setGrnId] = useState('');
  const [items, setItems] = useState<LocalLandedCostItem[]>([]);

  useEffect(() => {
    fetchGrns();
  }, []);

  useEffect(() => {
    // Auto-select GRN from query parameter
    const grnIdFromUrl = searchParams.get('grnId');
    if (grnIdFromUrl && grns.length > 0) {
      const foundGrn = grns.find(g => g.id === grnIdFromUrl);
      if (foundGrn) {
        onGrnChange(grnIdFromUrl);
      }
    }
  }, [grns, searchParams]);

  const fetchGrns = async () => {
    try {
      const data = await getGrns();
      // Filter for LOCAL GRNs that need landed cost:
      // 1. Direct PO + Local
      // 2. PR-linked FINISH GOODS + Local
      const localGrns = data.filter((g: any) => {
        if (g.status !== 'RECEIVED_UNVALUED') return false;
        if (g.orderType !== 'LOCAL' && g.orderType) return false; // Only local or unset
        
        const po = g.purchaseOrder;
        if (!po) return false;
        
        const isDirectPo = !po.purchaseRequisitionId && !po.vendorQuotationId && !po.rfqId;
        const isPrLinkedFresh = po.purchaseRequisition?.goodsType === 'FRESH';
        
        return isDirectPo || isPrLinkedFresh;
      });
      setGrns(localGrns);
    } catch (err) {
      toast.error('Failed to load GRNs');
    }
  };

  const onGrnChange = async (id: string) => {
    setGrnId(id);
    const grn = grns.find(g => g.id === id);
    if (!grn) return;

    setSelectedGrn(grn);
    setLoading(true);

    try {
      // Map items from GRN
      const grnItems = Array.isArray(grn.items) ? grn.items : [];
      const localItems: LocalLandedCostItem[] = grnItems.map((gi: any) => {
        const poItems = (grn as any).purchaseOrder?.items || [];
        const poItem = poItems.find((pi: any) => String(pi.itemId) === String(gi.itemId));
        const unitPrice = poItem ? parseFloat(String(poItem.unitPrice)) : 0;
        const qty = parseFloat(String(gi.receivedQty || 0));

        return {
          itemId: gi.itemId,
          itemName: gi.itemId, // Will be enriched later
          description: gi.description || '',
          qty: qty,
          unitPrice: unitPrice,
          totalAmount: qty * unitPrice
        };
      });

      setItems(localItems);
    } catch (err: any) {
      toast.error('Failed to load items from GRN');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!grnId) {
      toast.error('Please select a GRN');
      return;
    }

    setLoading(true);
    try {
      // For local purchases, we just post with minimal data
      const payload = {
        grnId,
        orderType: 'LOCAL',
        currency: 'PKR',
        exchangeRate: 1,
        items: items.map(i => ({
          itemId: i.itemId,
          description: i.description,
          qty: i.qty,
          unitPrice: i.unitPrice,
          totalAmount: i.totalAmount
        }))
      };

      const res = await createLocalLandedCost(payload);
      toast.success('Local Landed Cost posted successfully');
      router.push('/erp/procurement/landed-cost');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post landed cost');
    } finally {
      setLoading(false);
    }
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + item.totalAmount, 0);
  };

  return (
    <PermissionGuard permissions="erp.procurement.landed-cost.create">
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Local Landed Cost</h1>
          <p className="text-muted-foreground">Simple landed cost posting for local purchases (PKR currency)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>GRN Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Local GRN</Label>
              <Select value={grnId} onValueChange={onGrnChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select GRN" />
                </SelectTrigger>
                <SelectContent>
                  {grns.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.grnNumber} - {g.purchaseOrder?.poNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGrn && (
              <div className="space-y-2 p-3 bg-muted rounded">
                <div className="text-sm">
                  <strong>GRN:</strong> {selectedGrn.grnNumber}
                </div>
                <div className="text-sm">
                  <strong>PO:</strong> {(selectedGrn as any).purchaseOrder?.poNumber}
                </div>
                <div className="text-sm">
                  <strong>Warehouse:</strong> {selectedGrn.warehouse?.name}
                </div>
                <div className="text-sm">
                  <strong>Order Type:</strong> Local
                </div>
                <div className="text-sm">
                  <strong>Currency:</strong> PKR (Pakistani Rupees)
                </div>
              </div>
            )}

            <div className="pt-4">
              <Button 
                className="w-full" 
                onClick={handleSubmit} 
                disabled={loading || !grnId || items.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Posting...' : 'Post Local Landed Cost'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Items Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10">Loading items...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price (PKR)</TableHead>
                    <TableHead className="text-right">Total Amount (PKR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        {grnId ? 'No items found in selected GRN' : 'Select a GRN to load items'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.itemId}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.qty.toFixed(2)}</TableCell>
                          <TableCell className="text-right">₨ {item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">₨ {item.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell colSpan={4} className="text-right font-bold">Grand Total:</TableCell>
                        <TableCell className="text-right font-bold text-lg">₨ {calculateGrandTotal().toFixed(2)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </PermissionGuard>
  );
}