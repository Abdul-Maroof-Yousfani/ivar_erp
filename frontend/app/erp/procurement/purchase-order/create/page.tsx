'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { itemApi, MasterItem, PurchaseRequisition, inventoryApi } from '@/lib/api';
import { getVendors } from '@/lib/actions/procurement';
import { getPurchaseRequisitions } from '@/lib/actions/purchase-requisition';
import { createPurchaseOrder, createMultiDirectPurchaseOrder } from '@/lib/actions/purchase-order';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Search, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Autocomplete } from '@/components/ui/autocomplete';
import { cn, formatCurrency } from '@/lib/utils';
import { PoBulkUploadModal } from '@/components/purchase-order/po-bulk-upload-modal';
import { PermissionGuard } from '@/components/auth/permission-guard';

interface OrderItem {
    itemId: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    vendorId?: string;
    // Display only
    itemName?: string;
    lineTotal?: number;
}

const resolveItemAvgCost = (item: any): number => {
    const avg = Number(item?.unitCost ?? 0);
    if (!Number.isNaN(avg) && avg > 0) return avg;
    const fallback = Number(item?.unitPrice ?? 0);
    return Number.isNaN(fallback) ? 0 : fallback;
};

export default function CreateDirectPurchaseOrder() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [items, setItems] = useState<MasterItem[]>([]);
    const [approvedPRs, setApprovedPRs] = useState<PurchaseRequisition[]>([]);

    // Form State
    const [selectedVendorId, setSelectedVendorId] = useState<string>('');
    const [selectedPRId, setSelectedPRId] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [multiVendorMode, setMultiVendorMode] = useState<boolean>(false);
    const [vendorTypeFilter, setVendorTypeFilter] = useState<'all' | 'local' | 'import'>('all');
    const [multiVendorTypeFilter, setMultiVendorTypeFilter] = useState<'all' | 'local' | 'import'>('all');
    const [orderType, setOrderType] = useState<string>('LOCAL');
    const [goodsType, setGoodsType] = useState<string>('CONSUMABLE');
    const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

    // Search — Popover multi-select (same as stock-transfer)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [quantity, setQuantity] = useState<number>(1);
    const [price, setPrice] = useState<number>(0);
    const [currentVendorId, setCurrentVendorId] = useState<string>('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        fetchData();
        searchInputRef.current?.focus();
    }, []);

    // ─── Keyboard shortcuts ─────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F2 → Focus search input
            if (e.key === "F2") {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // ─── Search Functionality ─────────────────────────────────
    const handleSearchChange = useCallback(async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await inventoryApi.search(query.trim());
            if (res.status && res.data) {
                setSearchResults(res.data.map((item: any) => ({
                    value: item.id,
                    label: `${item.sku} - ${item.description}`,
                    item: { ...item, availableStock: item.totalQuantity ?? 0 },
                })));
                if (!isPopoverOpen) setIsPopoverOpen(true);
            } else {
                setSearchResults([]);
            }
        } catch {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [isPopoverOpen]);

    const handleSelectItem = useCallback((item: any) => {
        // For PO: single select — clicking adds directly with current qty/price
        if (multiVendorMode && !currentVendorId) {
            toast.error('Select vendor for this item first');
            return;
        }
        const existingIndex = orderItems.findIndex(i => i.itemId === (item.itemId || item.id));
        if (existingIndex >= 0) {
            const updated = [...orderItems];
            updated[existingIndex].quantity += quantity;
            updated[existingIndex].lineTotal = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
            setOrderItems(updated);
            toast.info(`Updated quantity for ${item.description}`);
        } else {
            const unitPrice = price || resolveItemAvgCost(item);
            setOrderItems(prev => [...prev, {
                itemId: item.itemId || item.id,
                itemName: item.sku,
                description: item.description,
                quantity,
                unitPrice,
                lineTotal: quantity * unitPrice,
                vendorId: multiVendorMode ? currentVendorId : undefined,
            }]);
            toast.success(`Added ${item.description}`);
        }
        setIsPopoverOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    }, [orderItems, quantity, price, multiVendorMode, currentVendorId]);

    const fetchData = async () => {
        try {
            const [vendorsData, itemsData, prsData] = await Promise.all([
                getVendors(),
                itemApi.getAll(),
                getPurchaseRequisitions('APPROVED')
            ]);

            if (vendorsData?.data) {
                setVendors(vendorsData.data);
            }
            if (itemsData?.data) {
                setItems(itemsData.data);
            }
            if (prsData) {
                setApprovedPRs(prsData);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load data');
        }
    };

    const handlePRSelect = (prId: string) => {
        setSelectedPRId(prId);
        const pr = approvedPRs.find(p => p.id === prId);
        if (!pr || !pr.items) return;

        // Auto-select types from PR
        if (pr.type) setOrderType(pr.type.toUpperCase());
        if (pr.goodsType) setGoodsType(pr.goodsType.toUpperCase());

        // Map PR items to Order Items
        const newItems = pr.items.map(prItem => {
            const masterItem = items.find(i => i.id === prItem.itemId || i.itemId === prItem.itemId);
            const qty = parseFloat(prItem.requiredQty);
            const price = resolveItemAvgCost(masterItem);
            const lineTotal = qty * price;

            return {
                itemId: masterItem ? masterItem.id : prItem.itemId, // Enforce UUID
                itemName: masterItem?.sku || masterItem?.itemId || 'Unknown Item',
                description: masterItem?.description || '',
                quantity: qty,
                unitPrice: price,
                lineTotal: lineTotal
            };
        });

        setOrderItems(newItems);
        if (pr.notes) setNotes(prev => prev ? `${prev}\nPR Notes: ${pr.notes}` : `PR Notes: ${pr.notes}`);
    };

    const handleRemoveItem = useCallback((itemId: string) => {
        setOrderItems(prev => prev.filter(item => item.itemId !== itemId));
        toast.success("Item removed");
    }, []);

    const handleUpdateItem = (index: number, field: keyof OrderItem, value: string) => {
        const newItems = [...orderItems];
        const item = { ...newItems[index] };

        const numValue = parseFloat(value) || 0;
        (item as any)[field] = numValue;

        // Recalculate line total (simple multiplication without tax/discount)
        item.lineTotal = item.quantity * item.unitPrice;

        newItems[index] = item;
        setOrderItems(newItems);
    };

    const calculateTotal = () => {
        return orderItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    };

    const getFilteredVendors = (filterType: 'all' | 'local' | 'import') => {
        return vendors.filter(v => {
            if (filterType === 'all') return true;
            if (filterType === 'local') return v.type === 'LOCAL' || !v.type;
            if (filterType === 'import') return v.type === 'IMPORT' || v.type === 'INTERNATIONAL';
            return true;
        });
    };

    const handleSubmit = async () => {
        if (orderItems.length === 0) {
            toast.error('Please add at least one item');
            return;
        }
        if (!orderType || !['LOCAL', 'IMPORT'].includes(orderType)) {
            toast.error('Please select Order Type (LOCAL/IMPORT)');
            return;
        }
        if (!goodsType || !['CONSUMABLE', 'FRESH'].includes(goodsType)) {
            toast.error('Please select Goods Type (CONSUMABLE/FRESH)');
            return;
        }

        try {
            setLoading(true);
            if (!multiVendorMode) {
                if (!selectedVendorId) {
                    toast.error('Please select a vendor');
                    return;
                }
                const po = await createPurchaseOrder({
                    vendorId: selectedVendorId,
                    purchaseRequisitionId: selectedPRId || undefined,
                    items: orderItems.map(item => ({
                        itemId: item.itemId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice
                    })),
                    notes,
                    expectedDeliveryDate: expectedDeliveryDate || undefined,
                    orderType: orderType || undefined,
                    goodsType: goodsType || undefined
                });
                toast.success(`Purchase Order ${po.poNumber} created successfully`);
                router.push(`/erp/procurement/purchase-order/${po.id}`);
            } else {
                // Group items by vendorId
                const groups: Record<string, OrderItem[]> = {};
                for (const item of orderItems) {
                    if (!item.vendorId) {
                        toast.error('Select vendor for all items');
                        setLoading(false);
                        return;
                    }
                    if (!groups[item.vendorId]) groups[item.vendorId] = [];
                    groups[item.vendorId].push(item);
                }
                const payload = {
                    awards: Object.entries(groups).map(([vendorId, items]) => ({
                        vendorId,
                        items: items.map(i => ({
                            itemId: i.itemId,
                            description: i.description,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice
                        })),
                        notes,
                        expectedDeliveryDate: expectedDeliveryDate || undefined,
                        orderType: orderType || undefined,
                        goodsType: goodsType || undefined
                    }))
                };
                const result = await createMultiDirectPurchaseOrder(payload);
                if (Array.isArray(result) && result.length > 0) {
                    toast.success(`Created ${result.length} Purchase Orders`);
                    router.push(`/erp/procurement/purchase-order/${result[0].id}`);
                } else {
                    toast.error('Failed to create Purchase Orders');
                }
            }
        } catch (error: any) {
            console.error('Failed to create PO:', error);
            toast.error(error.message || 'Failed to create Purchase Order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.po.create">
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Create Direct Purchase Order</h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Bulk Import
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || orderItems.length === 0}>
                        {loading ? 'Creating...' : 'Create Purchase Order'}
                    </Button>
                </div>
            </div>

            {/* Keyboard shortcut hints */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-muted">F2</span>
                <span>Focus Search</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">Enter</span>
                <span>Select Item</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">Tab</span>
                <span>Next Field</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Vendor & Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Multi-vendor mode</Label>
                            <Input
                                type="checkbox"
                                checked={multiVendorMode}
                                onChange={(e) => setMultiVendorMode(e.target.checked)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Select PR (Optional)</Label>
                            <Select value={selectedPRId} onValueChange={handlePRSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Approved PR" />
                                </SelectTrigger>
                                <SelectContent>
                                    {approvedPRs.map((pr) => (
                                        <SelectItem key={pr.id} value={pr.id}>
                                            {pr.prNumber} - {pr.department || 'No Department'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!multiVendorMode && (
                        <div className="space-y-2">
                            <Label>Vendor</Label>
                            <div className="flex flex-col gap-2">
                                <Autocomplete
                                    options={[
                                        { value: 'all', label: 'All Types' },
                                        { value: 'local', label: 'Local' },
                                        { value: 'import', label: 'Import' }
                                    ]}
                                    value={vendorTypeFilter}
                                    onValueChange={(v: any) => setVendorTypeFilter(v)}
                                    placeholder="Filter Vendor Type"
                                />
                                <Autocomplete
                                    options={getFilteredVendors(vendorTypeFilter).map(v => ({
                                        value: v.id,
                                        label: `${v.name} (${v.code})`
                                    }))}
                                    value={selectedVendorId}
                                    onValueChange={setSelectedVendorId}
                                    placeholder="Select Vendor"
                                    className="w-full"
                                />
                            </div>
                        </div>
                        )}

                        <div className="space-y-2">
                            <Label>Expected Delivery Date</Label>
                            <DatePicker
                                value={expectedDeliveryDate}
                                onChange={(val) => setExpectedDeliveryDate(val)}
                                placeholder="Select delivery date"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Order Type</Label>
                            <Autocomplete
                                options={[
                                    { value: 'LOCAL', label: 'Local' },
                                    { value: 'IMPORT', label: 'Import' }
                                ]}
                                value={orderType}
                                onValueChange={setOrderType}
                                placeholder="Select Order Type"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Goods Type</Label>
                            <Autocomplete
                                options={[
                                    { value: 'CONSUMABLE', label: 'Consumable' },
                                    { value: 'FRESH', label: 'FINISH GOODS' }
                                ]}
                                value={goodsType}
                                onValueChange={setGoodsType}
                                placeholder="Select Goods Type"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any additional notes..."
                                className="min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Add Items</span>
                            {orderItems.length > 0 && <Badge variant="secondary">{orderItems.length} items</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Add Item Form */}
                        <div className="space-y-3 border-b pb-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex gap-3 items-end flex-wrap">
                                {/* Search Popover */}
                                <div className="flex-1 min-w-[200px] space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Search & Select Item</Label>
                                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    ref={searchInputRef}
                                                    placeholder="Type SKU or description…"
                                                    value={searchQuery}
                                                    onChange={(e) => handleSearchChange(e.target.value)}
                                                    onFocus={() => searchResults.length > 0 && setIsPopoverOpen(true)}
                                                    className="h-10 pl-10 border-primary/20"
                                                />
                                                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                            <Command shouldFilter={false}>
                                                <CommandList className="max-h-[320px]">
                                                    {searchResults.length === 0 ? (
                                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                                            {isSearching ? 'Searching…' : searchQuery.length > 0 ? `No items match "${searchQuery}"` : 'Type at least 2 characters'}
                                                        </div>
                                                    ) : (
                                                        <CommandGroup>
                                                            <div className="px-3 py-1.5 border-b border-muted/50">
                                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Results ({searchResults.length}) — click to add</span>
                                                            </div>
                                                            <ScrollArea className="h-[260px]">
                                                                {searchResults.map((opt: any) => {
                                                                    const item = opt.item;
                                                                    const isAdded = orderItems.some(i => i.itemId === (item.itemId || item.id));
                                                                    return (
                                                                        <CommandItem key={item.id} value={`${item.sku} ${item.description}`} onSelect={() => handleSelectItem(item)}
                                                                            className={cn("flex items-center justify-between gap-3 px-4 py-3 cursor-pointer border-b border-muted/50 last:border-0",
                                                                                isAdded ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-accent")}>
                                                                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded border font-bold",
                                                                                        isAdded ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-muted-foreground/20")}>
                                                                                        {item.sku}
                                                                                    </span>
                                                                                    <span className={cn("truncate text-sm", isAdded ? "font-bold text-primary" : "font-medium")}>{item.description}</span>
                                                                                </div>
                                                                                <span className="text-[11px] text-muted-foreground">Stock: <span className={cn("font-bold", item.availableStock > 0 ? "text-foreground" : "text-destructive")}>{item.availableStock ?? 0}</span></span>
                                                                            </div>
                                                                            <div className="shrink-0">
                                                                                {isAdded ? <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" /> : <Plus className="h-4 w-4 text-muted-foreground opacity-50" />}
                                                                            </div>
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </ScrollArea>
                                                        </CommandGroup>
                                                    )}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="w-24 space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Qty</Label>
                                    <Input type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="h-10" />
                                </div>
                                <div className="w-28 space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Unit Price</Label>
                                    <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-10" placeholder="0.00" />
                                </div>
                            </div>
                            {multiVendorMode && (
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Vendor for this item</Label>
                                        <div className="flex flex-col gap-2">
                                            <Autocomplete
                                                options={[
                                                    { value: 'all', label: 'All Types' },
                                                    { value: 'local', label: 'Local' },
                                                    { value: 'import', label: 'Import' }
                                                ]}
                                                value={multiVendorTypeFilter}
                                                onValueChange={(v: any) => setMultiVendorTypeFilter(v)}
                                                placeholder="Filter Vendor Type"
                                            />
                                            <Autocomplete
                                                options={getFilteredVendors(multiVendorTypeFilter).map(v => ({
                                                    value: v.id,
                                                    label: `${v.name} (${v.code})`
                                                }))}
                                                value={currentVendorId}
                                                onValueChange={setCurrentVendorId}
                                                placeholder="Select Vendor"
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground italic">Click an item in the dropdown to add it with the qty/price above.</p>
                        </div>

                        {/* Items Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item SKU</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orderItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                                No items added yet
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        orderItems.map((item, index) => (
                                            <TableRow key={`order-item-${index}-${item.itemId}`}>
                                                <TableCell>
                                                    <div className="font-medium">{item.itemName}</div>
                                                    <div className="text-sm text-muted-foreground">{item.description}</div>
                                                </TableCell>
                                            <TableCell>
                                                {multiVendorMode ? (
                                                    <span className="text-sm">
                                                        {vendors.find(v => v.id === item.vendorId)?.name || 'No vendor'}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        {vendors.find(v => v.id === selectedVendorId)?.name || 'Select vendor above'}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                                        className="w-20 ml-auto h-8 text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleUpdateItem(index, 'unitPrice', e.target.value)}
                                                        className="w-24 ml-auto h-8 text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(item.lineTotal || 0)}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.itemId)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-end pt-4">
                            <div className="text-right">
                                <div className="text-sm text-muted-foreground">Total Amount</div>
                                <div className="text-2xl font-bold">{formatCurrency(calculateTotal())}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <PoBulkUploadModal
                open={bulkUploadOpen}
                onOpenChange={setBulkUploadOpen}
                onSuccess={() => router.push('/erp/procurement/purchase-order')}
            />
        </div>
        </PermissionGuard>
    );
}
