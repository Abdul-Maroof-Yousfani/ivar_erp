'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deliveryChallanApi, customerApi } from '@/lib/api';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface DeliveryChallan {
  id: string;
  challanNo: string;
  customer: Customer;
  totalAmount: number;
  items: DeliveryChallanItem[];
}

interface DeliveryChallanItem {
  id: string;
  itemId: string;
  item: {
    description: string;
    sku: string;
  };
  deliveredQty: number;
  salePrice: number;
  total: number;
}

export default function CreateSalesInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveryChallans, setDeliveryChallans] = useState<DeliveryChallan[]>([]);

  const [formData, setFormData] = useState({
    deliveryChallanId: '',
    customerId: '',
    taxRate: 5,
    discount: 0,
    notes: '',
  });

  const [selectedChallan, setSelectedChallan] = useState<DeliveryChallan | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [customersData, challansData] = await Promise.all([
        customerApi.getAll(),
        deliveryChallanApi.getAll()
      ]);

      setCustomers(customersData.data || []);
      
      // Filter only delivered challans that can be invoiced (not already invoiced)
      const deliveredChallans = challansData.data?.filter((challan: any) => 
        challan.status === 'DELIVERED' && (!challan.invoices || challan.invoices.length === 0)
      ) || [];
      
      setDeliveryChallans(deliveredChallans);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }
  };

  const handleChallanSelection = (challanId: string) => {
    const challan = deliveryChallans.find(c => c.id === challanId);
    
    if (challan) {
      setSelectedChallan(challan);
      setFormData(prev => ({
        ...prev,
        deliveryChallanId: challanId,
        customerId: challan.customer.id,
      }));
    }
  };

  const calculateTotals = () => {
    if (!selectedChallan) {
      return { subtotal: 0, taxAmount: 0, totalAmount: 0 };
    }

    const subtotal = selectedChallan.totalAmount;
    const taxAmount = subtotal * (formData.taxRate / 100);
    const totalAmount = subtotal + taxAmount - formData.discount;

    return { subtotal, taxAmount, totalAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.deliveryChallanId) {
      toast.error('Please select a delivery challan');
      return;
    }

    setLoading(true);

    try {
      await deliveryChallanApi.createInvoice(formData.deliveryChallanId, {
        taxRate: formData.taxRate,
        discount: formData.discount,
        notes: formData.notes
      });

      toast.success('Sales invoice created successfully');
      router.push('/erp/sales/invoices');
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      
      // Show more specific error message
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create invoice';
      toast.error(errorMessage);
      
      // If the challan is no longer available, refresh the list
      if (errorMessage.includes('delivered') || errorMessage.includes('invoiced')) {
        fetchInitialData();
      }
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, totalAmount } = calculateTotals();

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/erp/sales/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Sales Invoice</h1>
          <p className="text-gray-600">Create a new customer invoice from delivery challan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deliveryChallan">Select Delivery Challan *</Label>
                <Select value={formData.deliveryChallanId} onValueChange={handleChallanSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery challan" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryChallans.map((challan) => (
                      <SelectItem key={challan.id} value={challan.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{challan.challanNo}</span>
                          <span className="text-sm text-muted-foreground">
                            {challan.customer?.name} - {formatCurrency(challan.totalAmount || 0)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {deliveryChallans.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No delivered challans available for invoicing
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="customer">Customer</Label>
                <Select value={formData.customerId} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Customer will be auto-selected" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="discount">Discount Amount</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  value={formData.discount}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes for the invoice"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice Items Preview */}
        {selectedChallan && (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items ({selectedChallan.items?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedChallan.items?.map((item, index) => (
                  <div key={index} className="border p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label>Item</Label>
                        <div className="text-sm">
                          <div className="font-medium">{item.item?.description || 'N/A'}</div>
                          <div className="text-muted-foreground">SKU: {item.item?.sku || 'N/A'}</div>
                        </div>
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <div className="text-sm font-medium">{item.deliveredQty}</div>
                      </div>
                      <div>
                        <Label>Sale Price</Label>
                        <div className="text-sm font-medium">{formatCurrency(item.salePrice || 0)}</div>
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No items found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({formData.taxRate}%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-{formatCurrency(formData.discount)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Amount:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end">
          <Link href="/erp/sales/invoices">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || !formData.deliveryChallanId}>
            {loading ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}