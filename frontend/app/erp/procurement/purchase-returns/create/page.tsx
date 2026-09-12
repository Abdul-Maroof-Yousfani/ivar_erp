'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { purchaseReturnApi, CreatePurchaseReturnDto } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PermissionGuard } from "@/components/auth/permission-guard";

interface SourceDocument {
  id: string;
  grnNumber?: string;
  landedCostNumber?: string;
  invoiceNumber?: string;
  supplier: { id: string; name: string };
  warehouse?: { id: string; name: string };
  items: Array<{
    id: string;
    itemId: string;
    description?: string;
    receivedQty?: number;
    qty?: number;
    unitPrice?: number;
    unitCostPKR?: number;
    displayCode?: number;
  }>;
}

export default function CreatePurchaseReturnPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState<'GRN' | 'LANDED_COST' | 'PURCHASE_INVOICE'>('GRN');
  const [eligibleDocs, setEligibleDocs] = useState<SourceDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SourceDocument | null>(null);
  
  const [formData, setFormData] = useState<CreatePurchaseReturnDto>({
    sourceType: 'GRN',
    supplierId: '',
    warehouseId: '',
    returnType: 'DEFECTIVE',
    reason: '',
    notes: '',
    items: [],
  });

  useEffect(() => {
    loadEligibleDocuments();
  }, [sourceType]);

  const loadEligibleDocuments = async () => {
    try {
      setLoading(true);
      const data = sourceType === 'GRN' 
        ? await purchaseReturnApi.getEligibleGrns()
        : sourceType === 'LANDED_COST'
        ? await purchaseReturnApi.getEligibleLandedCosts()
        : await purchaseReturnApi.getEligiblePurchaseInvoices();
      setEligibleDocs(data);
    } catch (error) {
      console.error('Error loading eligible documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceTypeChange = (type: 'GRN' | 'LANDED_COST' | 'PURCHASE_INVOICE') => {
    setSourceType(type);
    setSelectedDoc(null);
    setFormData({
      ...formData,
      sourceType: type,
      grnId: undefined,
      landedCostId: undefined,
      purchaseInvoiceId: undefined,
      supplierId: '',
      warehouseId: '',
      items: [],
    });
  };

  const handleDocumentSelect = (docId: string) => {
    const doc = eligibleDocs.find(d => d.id === docId);
    if (!doc || !doc.supplier) return;

    setSelectedDoc(doc);
    setFormData({
      ...formData,
      grnId: sourceType === 'GRN' ? docId : undefined,
      landedCostId: sourceType === 'LANDED_COST' ? docId : undefined,
      purchaseInvoiceId: sourceType === 'PURCHASE_INVOICE' ? docId : undefined,
      supplierId: doc.supplier.id,
      warehouseId: doc.warehouse?.id || '',
      items: doc.items.map(item => ({
        sourceItemType: sourceType === 'GRN' 
          ? 'GRN_ITEM' 
          : sourceType === 'LANDED_COST'
          ? 'LANDED_COST_ITEM'
          : 'PURCHASE_INVOICE_ITEM',
        grnItemId: sourceType === 'GRN' ? item.id : undefined,
        landedCostItemId: sourceType === 'LANDED_COST' ? item.id : undefined,
        purchaseInvoiceItemId: sourceType === 'PURCHASE_INVOICE' ? item.id : undefined,
        itemId: item.itemId,
        displayCode: (item as any).displayCode || item.itemId,
        description: item.description || '',
        returnQty: 0,
        unitPrice: item.unitPrice ?? item.unitCostPKR ?? 0,
        lineTotal: 0,
        reason: '',
      })),
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'returnQty') {
      updatedItems[index].lineTotal = value * updatedItems[index].unitPrice;
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate items have return quantities
    const validItems = formData.items.filter(item => item.returnQty > 0);
    if (validItems.length === 0) {
      alert('Please specify return quantities for at least one item');
      return;
    }

    try {
      setLoading(true);
      
      // Strip displayCode from items before sending to API 
      // (Redundant as itemId is already sent and causes 400 error due to forbidNonWhitelisted in backend)
      const apiItems = validItems.map(({ displayCode, ...item }: any) => item);

      await purchaseReturnApi.create({
        ...formData,
        items: apiItems,
      });
      router.push('/erp/procurement/purchase-returns');
    } catch (error) {
      console.error('Error creating purchase return:', error);
      alert('Error creating purchase return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PermissionGuard permissions="erp.procurement.pret.create">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
        
          <div>
            <h1 className="text-2xl font-bold">Create Purchase Return</h1>
            <p className="text-gray-600">Return items to supplier</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Source Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Return Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button
                  type="button"
                  variant={sourceType === 'GRN' ? 'default' : 'outline'}
                  onClick={() => handleSourceTypeChange('GRN')}
                >
                  From GRN (Direct)
                </Button>
                <Button
                  type="button"
                  variant={sourceType === 'LANDED_COST' ? 'default' : 'outline'}
                  onClick={() => handleSourceTypeChange('LANDED_COST')}
                >
                  From Landed Cost (Valued)
                </Button>
                <Button
                  type="button"
                  variant={sourceType === 'PURCHASE_INVOICE' ? 'default' : 'outline'}
                  onClick={() => handleSourceTypeChange('PURCHASE_INVOICE')}
                >
                  From Purchase Invoice (PI)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Select {sourceType === 'GRN' ? 'GRN' : sourceType === 'LANDED_COST' ? 'Landed Cost' : 'Purchase Invoice'}</Label>
                  <Select onValueChange={handleDocumentSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${sourceType === 'GRN' ? 'GRN' : sourceType === 'LANDED_COST' ? 'Landed Cost' : 'Purchase Invoice'}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleDocs.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {sourceType === 'GRN' ? doc.grnNumber : sourceType === 'LANDED_COST' ? doc.landedCostNumber : doc.invoiceNumber} - {doc.supplier?.name || 'Unknown Supplier'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDoc && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Return Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Return Type</Label>
                        <Select
                          value={formData.returnType}
                          onValueChange={(val: any) => setFormData({ ...formData, returnType: val })}
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
                      <div className="space-y-2">
                        <Label>Supplier</Label>
                        <Input value={selectedDoc.supplier?.name || 'Unknown Supplier'} disabled />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Reason for Return</Label>
                      <Textarea
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Why are you returning these items?"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Items to Return</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {formData.items.map((item, index) => (
                        <div key={index} className="p-4 border rounded-md space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold">{item.description}</div>
                              <div className="text-sm text-gray-500">{item.displayCode}</div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Quantity to Return</Label>
                              <Input
                                type="number"
                                min="0"
                                value={item.returnQty}
                                onChange={(e) => handleItemChange(index, 'returnQty', Number(e.target.value))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Unit Price</Label>
                              <div className="h-10 flex items-center px-3 border rounded-md bg-gray-50">
                                {formatCurrency(item.unitPrice)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Line Total</Label>
                              <div className="h-10 flex items-center px-3 border rounded-md bg-gray-50 font-semibold">
                                {formatCurrency(item.lineTotal)}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Item-specific Reason</Label>
                            <Input
                              placeholder="e.g., Specific defect description"
                              value={item.reason}
                              onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total Return Amount</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Internal Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Purchase Return'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </form>
      </div>
    </PermissionGuard>
  );
}