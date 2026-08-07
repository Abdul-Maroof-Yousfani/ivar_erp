'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Save,
  Search,
  Loader2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supplierApi } from '@/lib/api';
import {
  getPurchaseInvoice,
  updatePurchaseInvoice,
  searchItemsForDirectPI,
} from '@/lib/actions/purchase-invoice';
import { PermissionGuard } from '@/components/auth/permission-guard';

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface EditableInvoiceItem {
  id?: string;
  itemId: string;
  grnItemId?: string;
  landedCostItemId?: string;
  description: string;
  sku?: string;
  uom?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
  rollSize?: number;
}

export default function EditPurchaseInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<string>('DRAFT');

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [items, setItems] = useState<EditableInvoiceItem[]>([]);

  // Item Search Modal/Dropdown State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showItemSearch, setShowItemSearch] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadInitialData();
    }
  }, [invoiceId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch invoice and suppliers concurrently
      const [invoiceData, suppliersRes] = await Promise.all([
        getPurchaseInvoice(invoiceId),
        supplierApi.getAll().catch(() => ({ data: [] })),
      ]);

      if (suppliersRes?.data) {
        setSuppliers(suppliersRes.data);
      } else if (Array.isArray(suppliersRes)) {
        setSuppliers(suppliersRes);
      }

      if (!invoiceData) {
        toast.error('Purchase Invoice not found');
        router.push('/erp/procurement/purchase-invoice');
        return;
      }

      setInvoiceStatus(invoiceData.status);
      setInvoiceNumber(invoiceData.invoiceNumber || '');
      setInvoiceDate(
        invoiceData.invoiceDate
          ? new Date(invoiceData.invoiceDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setDueDate(
        invoiceData.dueDate
          ? new Date(invoiceData.dueDate).toISOString().split('T')[0]
          : ''
      );
      setSupplierId(invoiceData.supplierId || '');
      setNotes(invoiceData.notes || '');
      setDiscountAmount(Number(invoiceData.discountAmount || 0));

      if (invoiceData.items && Array.isArray(invoiceData.items)) {
        const loadedItems: EditableInvoiceItem[] = invoiceData.items.map((item: any) => ({
          id: item.id,
          itemId: item.itemId || item.item?.id,
          grnItemId: item.grnItemId,
          landedCostItemId: item.landedCostItemId,
          description: item.description || item.item?.name || '',
          sku: item.item?.sku || '',
          uom: item.item?.uom || '',
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Number(item.taxRate || 0),
          discountRate: Number(item.discountRate || 0),
          rollSize: item.rollSize ? Number(item.rollSize) : undefined,
        }));
        setItems(loadedItems);
      }
    } catch (error) {
      console.error('Error loading purchase invoice:', error);
      toast.error('Failed to load purchase invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchItems = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const results = await searchItemsForDirectPI(query);
      setSearchResults(results || []);
    } catch (err) {
      console.error('Failed to search items:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const addItemToInvoice = (item: any) => {
    const exists = items.some((i) => i.itemId === item.id);
    if (exists) {
      toast.info('Item is already added to invoice');
      return;
    }

    const newItem: EditableInvoiceItem = {
      itemId: item.id,
      description: item.name || item.sku || 'Item',
      sku: item.sku || '',
      uom: item.uom || '',
      quantity: 1,
      unitPrice: Number(item.costPrice || item.sellingPrice || 0),
      taxRate: 0,
      discountRate: 0,
    };

    setItems([...items, newItem]);
    setShowItemSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`Added ${item.name || item.sku}`);
  };

  const updateItemField = (index: number, field: keyof EditableInvoiceItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Subtotal calculation
  const subtotal = items.reduce((sum, item) => {
    const lineGross = item.quantity * item.unitPrice;
    const discount = lineGross * (item.discountRate / 100);
    return sum + (lineGross - discount);
  }, 0);

  // Tax calculation
  const totalTax = items.reduce((sum, item) => {
    const lineGross = item.quantity * item.unitPrice;
    const discount = lineGross * (item.discountRate / 100);
    const taxable = lineGross - discount;
    return sum + taxable * (item.taxRate / 100);
  }, 0);

  const grandTotal = Math.max(0, subtotal + totalTax - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      toast.error('Invoice must contain at least one item');
      return;
    }

    // Validate quantities and prices
    for (const item of items) {
      if (item.quantity <= 0) {
        toast.error(`Quantity for ${item.description || 'item'} must be greater than 0`);
        return;
      }
      if (item.unitPrice < 0) {
        toast.error(`Unit price for ${item.description || 'item'} cannot be negative`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await updatePurchaseInvoice(invoiceId, {
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        supplierId,
        discountAmount: Number(discountAmount),
        notes,
        items: items.map((i) => ({
          itemId: i.itemId,
          grnItemId: i.grnItemId,
          landedCostItemId: i.landedCostItemId,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          taxRate: Number(i.taxRate || 0),
          discountRate: Number(i.discountRate || 0),
          rollSize: i.rollSize !== undefined && i.rollSize !== null ? Number(i.rollSize) : undefined,
        })),
      });

      toast.success('Purchase Invoice updated successfully');
      router.push(`/erp/procurement/purchase-invoice/${invoiceId}`);
    } catch (error: any) {
      console.error('Failed to update purchase invoice:', error);
      toast.error(error.message || 'Failed to update purchase invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground font-medium">Loading Purchase Invoice...</span>
      </div>
    );
  }

  const isReadOnly = invoiceStatus !== 'DRAFT';

  return (
    <PermissionGuard permissions="erp.procurement.pi.update">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/erp/procurement/purchase-invoice/${invoiceId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Edit Purchase Invoice {invoiceNumber}
                </h1>
                <Badge
                  variant={invoiceStatus === 'DRAFT' ? 'outline' : 'default'}
                  className={
                    invoiceStatus === 'DRAFT'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : invoiceStatus === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : ''
                  }
                >
                  {invoiceStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Update draft purchase invoice details and line items.
              </p>
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-3">
              <Link href={`/erp/procurement/purchase-invoice/${invoiceId}`}>
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Warning Banner for Approved/Cancelled Invoices */}
        {isReadOnly && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-400">
                  Invoice Status is {invoiceStatus}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Only invoices in <strong>DRAFT</strong> status can be edited. This invoice cannot be modified.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Header Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Invoice Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="e.g. PI-2026-0001"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Select
                  value={supplierId}
                  onValueChange={setSupplierId}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name} ({sup.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <div className="mt-1">
                  <DatePicker
                    date={invoiceDate ? new Date(invoiceDate) : undefined}
                    onSelect={(d) =>
                      setInvoiceDate(d ? d.toISOString().split('T')[0] : '')
                    }
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <div className="mt-1">
                  <DatePicker
                    date={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(d) =>
                      setDueDate(d ? d.toISOString().split('T')[0] : '')
                    }
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes / Remarks</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Additional invoice notes or reference details..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Invoice Line Items ({items.length})
              </CardTitle>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowItemSearch(!showItemSearch)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Optional Item Search UI */}
              {showItemSearch && !isReadOnly && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        placeholder="Search items by SKU or description..."
                        value={searchQuery}
                        onChange={(e) => handleSearchItems(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowItemSearch(false)}
                    >
                      Close
                    </Button>
                  </div>

                  {searchLoading && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Searching items...
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border rounded-md bg-background divide-y">
                      {searchResults.map((resItem) => (
                        <div
                          key={resItem.id}
                          className="p-3 hover:bg-muted cursor-pointer flex items-center justify-between"
                          onClick={() => addItemToInvoice(resItem)}
                        >
                          <div>
                            <span className="font-semibold text-sm">
                              {resItem.sku}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {resItem.name}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            PKR {Number(resItem.costPrice || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="w-[100px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Unit Price</TableHead>
                      <TableHead className="w-[100px]">Tax Rate %</TableHead>
                      <TableHead className="w-[100px]">Disc Rate %</TableHead>
                      <TableHead className="w-[140px] text-right">Line Total</TableHead>
                      {!isReadOnly && <TableHead className="w-[60px] text-center">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isReadOnly ? 7 : 8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No items added to this invoice.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const lineGross = item.quantity * item.unitPrice;
                        const lineDisc = lineGross * ((item.discountRate || 0) / 100);
                        const taxable = lineGross - lineDisc;
                        const lineTax = taxable * ((item.taxRate || 0) / 100);
                        const lineTotal = taxable + lineTax;

                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-muted-foreground">
                              {idx + 1}
                            </TableCell>

                            <TableCell>
                              <Input
                                value={item.description}
                                onChange={(e) =>
                                  updateItemField(idx, 'description', e.target.value)
                                }
                                disabled={isReadOnly}
                                className="h-8 text-sm"
                              />
                              {item.sku && (
                                <span className="text-[11px] text-muted-foreground block mt-0.5">
                                  SKU: {item.sku}
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemField(
                                    idx,
                                    'quantity',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                disabled={isReadOnly}
                                className="h-8 text-sm w-20"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateItemField(
                                    idx,
                                    'unitPrice',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                disabled={isReadOnly}
                                className="h-8 text-sm w-24"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={item.taxRate}
                                onChange={(e) =>
                                  updateItemField(
                                    idx,
                                    'taxRate',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                disabled={isReadOnly}
                                className="h-8 text-sm w-20"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={item.discountRate}
                                onChange={(e) =>
                                  updateItemField(
                                    idx,
                                    'discountRate',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                disabled={isReadOnly}
                                className="h-8 text-sm w-20"
                              />
                            </TableCell>

                            <TableCell className="text-right font-medium">
                              PKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>

                            {!isReadOnly && (
                              <TableCell className="text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                  onClick={() => removeItem(idx)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Summary Calculations */}
              <div className="flex justify-end pt-4">
                <div className="w-full max-w-sm space-y-2 border p-4 rounded-lg bg-muted/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">
                      PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax Amount:</span>
                    <span className="font-medium">
                      PKR {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm pt-1">
                    <span className="text-muted-foreground">Overall Discount:</span>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="h-8 text-sm w-32 text-right"
                    />
                  </div>

                  <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold text-primary">
                    <span>Grand Total:</span>
                    <span>
                      PKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PermissionGuard>
  );
}
