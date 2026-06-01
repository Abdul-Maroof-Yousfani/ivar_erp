'use client';

import { useState, useEffect, useRef, startTransition, addTransitionType } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Autocomplete } from '@/components/ui/autocomplete';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Search, Filter, X, ChevronRight, Plus, CheckCircle2, Info,
    Loader2, Trash2, Save, FileText, ScanBarcode, Volume2, VolumeX,
    Keyboard, Sparkles
} from 'lucide-react';
import { supplierApi, warehouseApi } from '@/lib/api';
import { brandApi, categoryApi, silhouetteApi, genderApi } from '@/lib/api';
import {
    getNextInvoiceNumber,
    createPurchaseInvoice,
    searchItemsForDirectPI,
} from '@/lib/actions/purchase-invoice';
import Link from 'next/link';
import { PermissionGuard } from "@/components/auth/permission-guard";

interface Supplier { id: string; name: string; code: string; }

interface SelectedItem {
    id: string;
    sku: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountRate: number;
    notes: string;
}

export default function CreateDirectPurchaseInvoicePage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    // Header fields
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);

    // Supplier list
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
    const [warehouseId, setWarehouseId] = useState('');

    // Item selection state
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [itemOptions, setItemOptions] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [bulkQty, setBulkQty] = useState(1);
    const [bulkUnitPrice, setBulkUnitPrice] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    // Barcode scanner states
    const [barcodeTab, setBarcodeTab] = useState<'scan' | 'search'>('scan');
    const [globalScannerActive, setGlobalScannerActive] = useState(true);
    const [autoIncrement, setAutoIncrement] = useState(true);
    const [lastScannedItem, setLastScannedItem] = useState<{ sku: string; description: string; timestamp: string } | null>(null);
    const [scanning, setScanning] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [scannerInput, setScannerInput] = useState('');

    const scannerInputRef = useRef<HTMLInputElement>(null);

    // Web Audio API Synthesized Audio Cues
    const playScanSuccessBeep = () => {
        if (typeof window === 'undefined') return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1050, audioCtx.currentTime); // Crisp, positive beep
            gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        } catch (e) {
            console.warn('Audio Context failed:', e);
        }
    };

    const playScanErrorBuzz = () => {
        if (typeof window === 'undefined') return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc1.type = 'sawtooth';
            osc2.type = 'sawtooth';
            osc1.frequency.setValueAtTime(140, audioCtx.currentTime); // Bass/buzz mismatch sound
            osc2.frequency.setValueAtTime(143, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
            
            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 0.22);
            osc2.stop(audioCtx.currentTime + 0.22);
        } catch (e) {
            console.warn('Audio Context failed:', e);
        }
    };

    // Focus scanner helper
    const focusScannerInput = () => {
        if (scannerInputRef.current) {
            scannerInputRef.current.focus();
        }
    };

    // Auto-focus on mount and tab switch
    useEffect(() => {
        if (barcodeTab === 'scan') {
            const timer = setTimeout(() => {
                focusScannerInput();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [barcodeTab]);

    // Shortcut key: F2 to focus scanner input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                setBarcodeTab('scan');
                setTimeout(focusScannerInput, 50);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Barcode Resolution handler
    const handleBarcodeResolve = async (barcode: string) => {
        if (!barcode.trim()) return;
        setScanning(true);
        try {
            const results = await searchItemsForDirectPI(barcode.trim());
            if (!results || results.length === 0) {
                if (soundEnabled) playScanErrorBuzz();
                toast.error(`No item found for barcode/SKU: "${barcode}"`);
                return;
            }

            const cleanedBarcode = barcode.trim().toLowerCase();
            let matchedItem = results.find((item: any) => 
                (item.barCode && item.barCode.toLowerCase() === cleanedBarcode) ||
                (item.sku && item.sku.toLowerCase() === cleanedBarcode) ||
                (item.itemId && item.itemId.toLowerCase() === cleanedBarcode)
            );

            if (!matchedItem && results.length === 1) {
                matchedItem = results[0];
            } else if (!matchedItem && results.length > 1) {
                if (soundEnabled) playScanErrorBuzz();
                toast.warning(`Multiple items found for "${barcode}". Please use manual search.`);
                return;
            }

            if (!matchedItem) {
                if (soundEnabled) playScanErrorBuzz();
                toast.error(`No item found for barcode/SKU: "${barcode}"`);
                return;
            }

            const itemData = {
                id: matchedItem.id,
                sku: matchedItem.sku ?? matchedItem.itemId ?? '',
                description: matchedItem.description ?? matchedItem.name ?? '',
                unitPrice: matchedItem.unitPrice ?? matchedItem.unitCost ?? 0,
            };

            const existingIndex = selectedItems.findIndex(i => i.id === itemData.id);
            if (existingIndex > -1) {
                if (autoIncrement) {
                    setSelectedItems(prev => prev.map((item, idx) => 
                        idx === existingIndex 
                            ? { ...item, quantity: item.quantity + bulkQty }
                            : item
                    ));
                    if (soundEnabled) playScanSuccessBeep();
                    toast.success(`Incremented quantity for ${itemData.sku} (Total: ${selectedItems[existingIndex].quantity + bulkQty})`, {
                        id: `scan-inc-${itemData.id}`,
                    });
                } else {
                    if (soundEnabled) playScanErrorBuzz();
                    toast.info(`Item ${itemData.sku} is already added.`, {
                        id: `scan-dup-${itemData.id}`,
                    });
                }
            } else {
                setSelectedItems(prev => [...prev, {
                    id: itemData.id,
                    sku: itemData.sku,
                    description: itemData.description,
                    quantity: bulkQty,
                    unitPrice: bulkUnitPrice > 0 ? bulkUnitPrice : (itemData.unitPrice ?? 0),
                    taxRate: 0,
                    discountRate: 0,
                    notes: '',
                }]);
                if (soundEnabled) playScanSuccessBeep();
                toast.success(`Added ${itemData.sku} to invoice.`, {
                    id: `scan-add-${itemData.id}`,
                });
            }

            setLastScannedItem({
                sku: itemData.sku,
                description: itemData.description,
                timestamp: new Date().toLocaleTimeString(),
            });

        } catch (error) {
            if (soundEnabled) playScanErrorBuzz();
            toast.error('Failed to resolve scanned item');
        } finally {
            setScanning(false);
        }
    };

    // Global Scanner Keyboard Input Interceptor
    useEffect(() => {
        if (!globalScannerActive) return;

        let buffer = '';
        let lastKeyTime = Date.now();

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl) {
                const tag = activeEl.tagName.toLowerCase();
                const type = (activeEl as HTMLInputElement).type?.toLowerCase();

                if (activeEl.id === 'barcode-scanner-input') {
                    return;
                }

                if (
                    tag === 'textarea' ||
                    (tag === 'input' && (type === 'text' || type === 'number' || type === 'search' || type === 'date')) ||
                    activeEl.getAttribute('role') === 'combobox' ||
                    activeEl.classList.contains('autofocus-ignore')
                ) {
                    return;
                }
            }

            const now = Date.now();
            
            // Heuristic scanner emulator delay check
            if (now - lastKeyTime > 80 && buffer.length > 0) {
                buffer = '';
            }

            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (buffer.length >= 3) {
                    e.preventDefault();
                    const barcode = buffer;
                    buffer = '';
                    handleBarcodeResolve(barcode);
                } else {
                    buffer = '';
                }
            } else if (e.key.length === 1) {
                buffer += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [globalScannerActive, selectedItems, autoIncrement, bulkQty, bulkUnitPrice, soundEnabled]);

    // Filter state
    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [silhouettes, setSilhouettes] = useState<any[]>([]);
    const [genders, setGenders] = useState<any[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [pendingBrandIds, setPendingBrandIds] = useState<string[]>([]);
    const [pendingCategoryIds, setPendingCategoryIds] = useState<string[]>([]);
    const [pendingSilhouetteIds, setPendingSilhouetteIds] = useState<string[]>([]);
    const [pendingGenderIds, setPendingGenderIds] = useState<string[]>([]);
    const [appliedFilters, setAppliedFilters] = useState<{
        brandIds: string[]; categoryIds: string[]; silhouetteIds: string[]; genderIds: string[];
    }>({ brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] });
    const activeFilterCount =
        appliedFilters.brandIds.length + appliedFilters.categoryIds.length +
        appliedFilters.silhouetteIds.length + appliedFilters.genderIds.length;

    const [filterSearch, setFilterSearch] = useState('');
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        loadInitial();
    }, []);

    const loadInitial = async () => {
        const [suppliersRes, warehousesRes, brandsRes, catsRes, silsRes, gensRes, invoiceNumRes] = await Promise.allSettled([
            supplierApi.getAll(),
            warehouseApi.getAll(),
            brandApi.getAll(),
            categoryApi.getAll(),
            silhouetteApi.getAll(),
            genderApi.getAll(),
            getNextInvoiceNumber(),
        ]);
        if (suppliersRes.status === 'fulfilled') {
            const d = suppliersRes.value;
            setSuppliers((d as any).data ?? d ?? []);
        }
        if (warehousesRes.status === 'fulfilled') {
            const whs = warehousesRes.value as any[];
            setWarehouses(whs.map(w => ({ id: w.id, name: w.name })));
        }
        if (brandsRes.status === 'fulfilled' && (brandsRes.value as any).status) setBrands((brandsRes.value as any).data);
        if (catsRes.status === 'fulfilled' && (catsRes.value as any).status) setCategories((catsRes.value as any).data);
        if (silsRes.status === 'fulfilled' && (silsRes.value as any).status) setSilhouettes((silsRes.value as any).data);
        if (gensRes.status === 'fulfilled' && (gensRes.value as any).status) setGenders((gensRes.value as any).data);
        if (invoiceNumRes.status === 'fulfilled' && invoiceNumRes.value) {
            setInvoiceNumber((invoiceNumRes.value as any).nextInvoiceNumber ?? '');
        }
    };

    const handleItemSearch = async (query: string, overrideFilters?: typeof appliedFilters) => {
        setSearchQuery(query);
        const active = overrideFilters ?? appliedFilters;
        const hasFilters = active.brandIds.length > 0 || active.categoryIds.length > 0 ||
            active.silhouetteIds.length > 0 || active.genderIds.length > 0;
        if ((!query || query.length < 2) && !hasFilters) {
            setItemOptions([]);
            return;
        }
        setSearchLoading(true);
        try {
            const results = await searchItemsForDirectPI(query, active);
            const options = (results as any[]).map((item: any) => ({
                value: item.id,
                label: `${item.sku} - ${item.description ?? item.name ?? ''}`,
                item: {
                    id: item.id,
                    sku: item.sku ?? item.itemId ?? '',
                    description: item.description ?? item.name ?? '',
                    unitPrice: item.unitPrice ?? item.unitCost ?? 0,
                },
            }));
            setItemOptions(options);
            if (!isPopoverOpen) setIsPopoverOpen(true);
        } catch {
            toast.error('Item search failed');
        } finally {
            setSearchLoading(false);
        }
    };

    const toggleItemSelection = (itemData: any) => {
        const isSelected = selectedItems.find(i => i.id === itemData.id);
        if (isSelected) {
            setSelectedItems(prev => prev.filter(i => i.id !== itemData.id));
        } else {
            if (bulkQty <= 0) { toast.error('Quantity must be > 0'); return; }
            setSelectedItems(prev => [...prev, {
                id: itemData.id,
                sku: itemData.sku,
                description: itemData.description,
                quantity: bulkQty,
                unitPrice: bulkUnitPrice > 0 ? bulkUnitPrice : (itemData.unitPrice ?? 0),
                taxRate: 0,
                discountRate: 0,
                notes: '',
            }]);
        }
    };

    const updateItem = (id: string, field: keyof SelectedItem, value: any) => {
        setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const removeItem = (id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id));

    const calculateTotals = () => {
        const subtotal = selectedItems.reduce((sum, item) => {
            const line = item.quantity * item.unitPrice;
            return sum + line - line * (item.discountRate / 100);
        }, 0);
        const taxAmount = selectedItems.reduce((sum, item) => {
            const line = item.quantity * item.unitPrice;
            const discounted = line - line * (item.discountRate / 100);
            return sum + discounted * (item.taxRate / 100);
        }, 0);
        return { subtotal, taxAmount, total: subtotal + taxAmount - discountAmount };
    };

    const { subtotal, taxAmount, total } = calculateTotals();

    const handleSubmit = async () => {
        if (!supplierId) { toast.error('Please select a supplier'); return; }
        if (!warehouseId) { toast.error('Please select a warehouse'); return; }
        if (selectedItems.length === 0) { toast.error('Add at least one item'); return; }
        if (selectedItems.some(i => i.quantity <= 0)) { toast.error('All quantities must be > 0'); return; }
        if (selectedItems.some(i => i.unitPrice <= 0)) { toast.error('All unit prices must be > 0'); return; }

        setSubmitting(true);
        try {
            await createPurchaseInvoice({
                invoiceNumber,
                invoiceDate,
                dueDate: dueDate || undefined,
                supplierId,
                warehouseId,
                invoiceType: 'DIRECT',
                discountAmount,
                notes: notes || undefined,
                items: selectedItems.map(i => ({
                    itemId: i.id,
                    description: i.description,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    taxRate: i.taxRate,
                    discountRate: i.discountRate,
                })),
            });
            toast.success('Purchase invoice created');
            startTransition(() => {
                addTransitionType('nav-forward');
                router.push('/erp/procurement/purchase-invoice');
            });
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to create invoice');
        } finally {
            setSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }));

    return (
        <PermissionGuard permissions="erp.procurement.pi.create">
            <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Direct Purchase Invoice</h1>
                        <p className="text-muted-foreground">Create a supplier invoice without GRN or PO</p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/erp/procurement/purchase-invoice" transitionTypes={['nav-forward']}>
                            <Button variant="outline">Cancel</Button>
                        </Link>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            <Save className="h-4 w-4 mr-2" />
                            {submitting ? 'Saving...' : 'Save Invoice'}
                        </Button>
                    </div>
                </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left panel — invoice details */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Invoice Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                            <Input value={invoiceNumber} disabled className="bg-muted/40 font-mono text-sm" />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Invoice Date *</Label>
                            <DatePicker value={invoiceDate} onChange={setInvoiceDate} placeholder="Select date" />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Due Date</Label>
                            <DatePicker value={dueDate} onChange={setDueDate} placeholder="Select due date" />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Supplier *</Label>
                            <Autocomplete
                                options={supplierOptions}
                                value={supplierId}
                                onValueChange={setSupplierId}
                                placeholder="Search supplier..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Warehouse * <span className="text-[10px] text-primary">(inventory destination)</span></Label>
                            <Autocomplete
                                options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                                value={warehouseId}
                                onValueChange={setWarehouseId}
                                placeholder="Search warehouse..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Notes</Label>
                            <Input
                                placeholder="Optional notes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>

                        {/* Totals summary */}
                        <div className="pt-4 border-t space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Tax</span>
                                <span>{taxAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Discount</span>
                                <Input
                                    type="number"
                                    min="0"
                                    value={discountAmount}
                                    onChange={e => setDiscountAmount(Number(e.target.value))}
                                    className="h-7 w-28 text-right text-sm"
                                />
                            </div>
                            <div className="flex justify-between font-bold text-base pt-1 border-t">
                                <span>Total</span>
                                <span className="text-primary">{total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                            <Save className="h-4 w-4 mr-2" />
                            {submitting ? 'Saving...' : 'Save Invoice'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Right panel — items */}
                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle>Items & Quantities</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary">{selectedItems.length} Items Selected</Badge>

                            {/* Filter trigger */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="relative inline-flex">
                                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsFilterOpen(true)}>
                                            <Filter className="h-4 w-4" />
                                        </Button>
                                        {activeFilterCount > 0 && (
                                            <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground flex items-center justify-center z-10">
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {activeFilterCount > 0
                                        ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active — click to edit`
                                        : 'Filter items by brand, category, silhouette or gender'}
                                </TooltipContent>
                            </Tooltip>

                            {activeFilterCount > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPendingBrandIds([]); setPendingCategoryIds([]);
                                                setPendingSilhouetteIds([]); setPendingGenderIds([]);
                                                const cleared = { brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] };
                                                setAppliedFilters(cleared);
                                                setItemOptions([]);
                                            }}
                                            className="flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Clear all filters</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Filter Sheet */}
                        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <SheetContent side="right" className="w-[360px] sm:w-[400px] flex flex-col p-0">
                                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                                    <SheetTitle className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-primary" />
                                        Filter Items
                                        {activeFilterCount > 0 && (
                                            <Badge className="h-5 text-[10px] px-1.5 bg-primary text-primary-foreground">{activeFilterCount}</Badge>
                                        )}
                                    </SheetTitle>
                                    <div className="relative mt-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search across all filters..."
                                            value={filterSearch}
                                            onChange={e => setFilterSearch(e.target.value)}
                                            className="pl-9 h-9 text-sm"
                                        />
                                        {filterSearch && (
                                            <button type="button" onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        )}
                                    </div>
                                </SheetHeader>

                                <ScrollArea className="flex-1 px-5 py-3">
                                    <div className="space-y-3">
                                        {(
                                            [
                                                { key: 'brand', label: 'Brand', items: brands, ids: pendingBrandIds, setIds: setPendingBrandIds },
                                                { key: 'category', label: 'Category', items: categories, ids: pendingCategoryIds, setIds: setPendingCategoryIds },
                                                { key: 'silhouette', label: 'Silhouette', items: silhouettes, ids: pendingSilhouetteIds, setIds: setPendingSilhouetteIds },
                                                { key: 'gender', label: 'Gender', items: genders, ids: pendingGenderIds, setIds: setPendingGenderIds },
                                            ] as const
                                        ).map(({ key, label, items, ids, setIds }) => {
                                            const filtered = filterSearch
                                                ? items.filter((i: any) => i.name.toLowerCase().includes(filterSearch.toLowerCase()))
                                                : items;
                                            if (filtered.length === 0) return null;
                                            const isCollapsed = collapsedSections[key];
                                            const selectedCount = ids.length;
                                            return (
                                                <div key={key} className="rounded-md border border-border overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSection(key)}
                                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span>{label}</span>
                                                            {selectedCount > 0 && (
                                                                <Badge variant="secondary" className="h-4 text-[10px] px-1">{selectedCount}</Badge>
                                                            )}
                                                        </div>
                                                        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', !isCollapsed && 'rotate-90')} />
                                                    </button>
                                                    {!isCollapsed && (
                                                        <div className="p-3">
                                                            <ScrollArea className="h-[180px]" showShadows>
                                                                <div className="flex flex-wrap gap-1.5 pr-3">
                                                                    {filtered.map((item: any) => (
                                                                        <button
                                                                            key={item.id}
                                                                            type="button"
                                                                            onClick={() => (setIds as any)((prev: string[]) =>
                                                                                prev.includes(item.id) ? prev.filter((x: string) => x !== item.id) : [...prev, item.id]
                                                                            )}
                                                                            className={cn(
                                                                                'px-2.5 py-1 rounded-full text-xs border transition-all',
                                                                                ids.includes(item.id)
                                                                                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                                                                    : 'bg-background border-border hover:border-primary/60 hover:bg-primary/5'
                                                                            )}
                                                                        >{item.name}</button>
                                                                    ))}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>

                                <SheetFooter className="px-5 py-4 border-t flex-row gap-2">
                                    <Button
                                        className="flex-1"
                                        onClick={() => {
                                            const newFilters = {
                                                brandIds: pendingBrandIds,
                                                categoryIds: pendingCategoryIds,
                                                silhouetteIds: pendingSilhouetteIds,
                                                genderIds: pendingGenderIds,
                                            };
                                            setAppliedFilters(newFilters);
                                            setIsFilterOpen(false);
                                            handleItemSearch(searchQuery, newFilters);
                                            if (!isPopoverOpen) setIsPopoverOpen(true);
                                        }}
                                    >
                                        Apply Filters
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPendingBrandIds([]); setPendingCategoryIds([]);
                                            setPendingSilhouetteIds([]); setPendingGenderIds([]);
                                            const cleared = { brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] };
                                            setAppliedFilters(cleared);
                                            setItemOptions([]);
                                        }}
                                    >
                                        <X className="h-3.5 w-3.5 mr-1" /> Clear
                                    </Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>

                        {/* Search & bulk add */}
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                            {/* Barcode / Search Tabs */}
                            <div className="flex border-b border-muted/50 mb-4 gap-2 pb-0.5">
                                <button
                                    type="button"
                                    onClick={() => setBarcodeTab('scan')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-all select-none focus:outline-none",
                                        barcodeTab === 'scan'
                                            ? "border-primary text-primary font-bold"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <ScanBarcode className="h-4 w-4" />
                                    Barcode Scanning
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBarcodeTab('search')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-all select-none focus:outline-none",
                                        barcodeTab === 'search'
                                            ? "border-primary text-primary font-bold"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Search className="h-4 w-4" />
                                    Manual Bulk Search
                                </button>
                            </div>

                            {barcodeTab === 'scan' ? (
                                <div className="space-y-4">
                                    <style dangerouslySetInnerHTML={{ __html: `
                                        @keyframes laser-sweep {
                                            0% { top: 0%; opacity: 0.2; }
                                            50% { opacity: 1; }
                                            100% { top: 100%; opacity: 0.2; }
                                        }
                                        .animate-laser-sweep {
                                            animation: laser-sweep 2.5s infinite ease-in-out;
                                        }
                                    `}} />

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Visual scanner glowing box */}
                                        <div className="md:col-span-1 relative h-36 bg-neutral-950 rounded-lg overflow-hidden border border-primary/20 flex flex-col items-center justify-center p-4 group select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                                            {/* Glowing background pulses */}
                                            <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors duration-500" />
                                            
                                            {/* Simulated laser scan line */}
                                            <div className="absolute left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] animate-laser-sweep z-10" />
                                            
                                            {/* Visual scanner elements */}
                                            <div className="z-20 text-center space-y-2">
                                                <div className="inline-flex p-2 bg-neutral-900 border border-neutral-800 rounded-full text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]">
                                                    <ScanBarcode className={cn("h-6 w-6", scanning ? "animate-pulse" : "")} />
                                                </div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono font-bold">
                                                    {scanning ? 'Resolving Code...' : 'Scanner Hook Active'}
                                                </div>
                                                <div className="text-[11px] text-neutral-400">
                                                    Press <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-850 rounded text-[10px] font-mono text-primary font-bold shadow-sm">F2</kbd> to focus scanner
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main Scanning Controls and inputs */}
                                        <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                                            <div className="flex flex-col md:flex-row gap-3 items-end">
                                                {/* Bulk quantity and Unit Price overrides */}
                                                <div className="w-full md:w-24 space-y-1">
                                                    <Label htmlFor="scan-qty" className="text-xs text-muted-foreground">Scan Qty</Label>
                                                    <Input
                                                        id="scan-qty"
                                                        type="number"
                                                        min="1"
                                                        value={bulkQty}
                                                        onChange={e => setBulkQty(Number(e.target.value))}
                                                        className="h-9 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                    />
                                                </div>
                                                <div className="w-full md:w-32 space-y-1">
                                                    <Label htmlFor="scan-price" className="text-xs text-muted-foreground">Unit Price override</Label>
                                                    <Input
                                                        id="scan-price"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={bulkUnitPrice}
                                                        onChange={e => setBulkUnitPrice(Number(e.target.value))}
                                                        className="h-9 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                        placeholder="Auto (Master)"
                                                    />
                                                </div>

                                                {/* Scanner input field */}
                                                <div className="flex-1 space-y-1 w-full">
                                                    <Label htmlFor="barcode-scanner-input" className="text-xs text-muted-foreground">Scan Barcode / SKU</Label>
                                                    <div className="relative">
                                                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                                        <Input
                                                            id="barcode-scanner-input"
                                                            ref={scannerInputRef}
                                                            type="text"
                                                            placeholder="Scan with handheld scanner, or type SKU and hit Enter..."
                                                            value={scannerInput}
                                                            onChange={e => setScannerInput(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleBarcodeResolve(scannerInput);
                                                                    setScannerInput('');
                                                                }
                                                            }}
                                                            className="h-9 pl-9 pr-10 border-primary/30 focus-visible:ring-primary shadow-sm font-mono text-sm"
                                                        />
                                                        {scanning && (
                                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scanner Config Settings */}
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs select-none border-t border-muted/50">
                                                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                                                    <input
                                                        type="checkbox"
                                                        checked={globalScannerActive}
                                                        onChange={e => setGlobalScannerActive(e.target.checked)}
                                                        className="rounded border-neutral-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <Keyboard className="h-3.5 w-3.5 text-muted-foreground/75" />
                                                        <span>Global Background Listener</span>
                                                    </div>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                                                    <input
                                                        type="checkbox"
                                                        checked={autoIncrement}
                                                        onChange={e => setAutoIncrement(e.target.checked)}
                                                        className="rounded border-neutral-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <Plus className="h-3.5 w-3.5 text-muted-foreground/75" />
                                                        <span>Auto-increment quantity</span>
                                                    </div>
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium md:ml-auto"
                                                >
                                                    {soundEnabled ? (
                                                        <>
                                                            <Volume2 className="h-4 w-4 text-primary" />
                                                            <span>Auditory Beeps (On)</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <VolumeX className="h-4 w-4 text-muted-foreground" />
                                                            <span>Auditory Beeps (Muted)</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Last Scanned Item micro-card */}
                                    {lastScannedItem ? (
                                        <div className="flex items-center justify-between p-2.5 bg-primary/10 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/20 text-primary shrink-0">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded leading-none">
                                                            {lastScannedItem.sku}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-semibold">Last scanned item</span>
                                                    </div>
                                                    <p className="text-xs font-semibold truncate text-foreground mt-0.5">
                                                        {lastScannedItem.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-mono bg-background border px-2 py-0.5 rounded select-none shadow-sm">
                                                {lastScannedItem.timestamp}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center p-3.5 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20 flex-col gap-1 text-center select-none">
                                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground/55 animate-pulse" />
                                            <p className="text-[11px] text-muted-foreground">Scanner ready. Scan a barcode to instantly add an item.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row gap-3 items-end">
                                        <div className="w-full md:w-28 space-y-1.5">
                                            <Label htmlFor="bulk-qty" className="text-xs text-muted-foreground">Bulk Qty</Label>
                                            <Input
                                                id="bulk-qty"
                                                type="number"
                                                min="1"
                                                value={bulkQty}
                                                onChange={e => setBulkQty(Number(e.target.value))}
                                                className="h-10 border-primary/20 focus-visible:ring-primary shadow-sm"
                                            />
                                        </div>
                                        <div className="w-full md:w-36 space-y-1.5">
                                            <Label htmlFor="bulk-price" className="text-xs text-muted-foreground">Bulk Unit Price</Label>
                                            <Input
                                                id="bulk-price"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={bulkUnitPrice}
                                                onChange={e => setBulkUnitPrice(Number(e.target.value))}
                                                className="h-10 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <div className="flex-1 space-y-1.5 relative w-full">
                                            <Label htmlFor="item-search" className="text-xs text-muted-foreground">Search Items (Select Multiple)</Label>
                                            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            id="item-search"
                                                            placeholder="Type SKU or description to search..."
                                                            value={searchQuery}
                                                            onChange={e => handleItemSearch(e.target.value)}
                                                            onFocus={() => searchQuery.length >= 2 && setIsPopoverOpen(true)}
                                                            className="h-10 pl-10 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                        />
                                                        {searchLoading && (
                                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-primary/10"
                                                    align="start"
                                                    onOpenAutoFocus={(e: Event) => e.preventDefault()}
                                                >
                                                    <Command className="rounded-lg" shouldFilter={false}>
                                                        <CommandList className="max-h-[350px]">
                                                            {itemOptions.length === 0 ? (
                                                                <div className="py-6 px-4 text-center space-y-1">
                                                                    {searchLoading ? (
                                                                        <p className="text-sm text-muted-foreground">Searching...</p>
                                                                    ) : searchQuery.length > 0 && activeFilterCount > 0 ? (
                                                                        <>
                                                                            <p className="text-sm font-medium text-muted-foreground">No results for "{searchQuery}"</p>
                                                                            <p className="text-xs text-muted-foreground">with {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}. Try clearing some filters.</p>
                                                                        </>
                                                                    ) : searchQuery.length > 0 ? (
                                                                        <>
                                                                            <p className="text-sm font-medium text-muted-foreground">No items match "{searchQuery}"</p>
                                                                            <p className="text-xs text-muted-foreground">Try a different SKU or description.</p>
                                                                        </>
                                                                    ) : activeFilterCount > 0 ? (
                                                                        <>
                                                                            <p className="text-sm font-medium text-muted-foreground">No items match the active filters</p>
                                                                            <p className="text-xs text-muted-foreground">Try removing some filters or type a search term.</p>
                                                                        </>
                                                                    ) : (
                                                                        <p className="text-sm text-muted-foreground">Type at least 2 characters to search, or apply filters above.</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <CommandGroup>
                                                                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-muted/50">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Results</span>
                                                                            <span className="text-xs text-muted-foreground">({itemOptions.length})</span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            className="text-xs text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                                                                            onClick={() => {
                                                                                const unselected = itemOptions
                                                                                    .map((o: any) => o.item)
                                                                                    .filter((item: any) => !selectedItems.some(s => s.id === item.id));
                                                                                unselected.forEach((item: any) => toggleItemSelection(item));
                                                                            }}
                                                                        >
                                                                            Select all
                                                                        </button>
                                                                    </div>
                                                                    <ScrollArea showShadows className="h-[300px]">
                                                                        {itemOptions.map((opt) => {
                                                                            const item = opt.item;
                                                                            const isSelected = selectedItems.some(i => i.id === item.id);
                                                                            return (
                                                                                <CommandItem
                                                                                    key={item.id}
                                                                                    value={`${item.sku} ${item.description}`}
                                                                                    onSelect={() => toggleItemSelection(item)}
                                                                                    className={cn(
                                                                                        'flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-muted/50 last:border-0',
                                                                                        isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-accent'
                                                                                    )}
                                                                                >
                                                                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className={cn(
                                                                                                'font-mono text-[10px] px-1.5 py-0.5 rounded border leading-none font-bold',
                                                                                                isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-muted-foreground/20'
                                                                                            )}>
                                                                                                {item.sku}
                                                                                            </span>
                                                                                            <span className={cn(
                                                                                                'truncate text-sm',
                                                                                                isSelected ? 'font-bold text-primary' : 'font-medium'
                                                                                            )}>
                                                                                                {item.description}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <span className="text-[11px] text-muted-foreground">
                                                                                                Unit Price: <span className="font-bold text-foreground">{(item.unitPrice ?? 0).toLocaleString()}</span>
                                                                                            </span>
                                                                                            {isSelected && (
                                                                                                <Badge variant="outline" className="h-4 text-[9px] px-1 bg-primary/5 text-primary border-primary/20">Added</Badge>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="shrink-0 flex items-center justify-center w-8">
                                                                                        {isSelected
                                                                                            ? <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                                                                                            : <Plus className="h-4 w-4 text-muted-foreground opacity-50" />
                                                                                        }
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
                                    </div>
                                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/5">
                                        <div className="flex items-center gap-2 text-primary font-medium italic">
                                            <Info className="h-3 w-3" />
                                            <span>Click items to toggle selection. Popover stays open for multiple selects.</span>
                                        </div>
                                        <div className="font-semibold">{selectedItems.length} items currently in list</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items table */}
                        <div className="border rounded-lg overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[130px]">SKU</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[90px] text-center">Qty</TableHead>
                                        <TableHead className="w-[120px]">Unit Price</TableHead>
                                        <TableHead className="w-[90px]">Tax %</TableHead>
                                        <TableHead className="w-[90px]">Disc %</TableHead>
                                        <TableHead className="w-[110px] text-right">Line Total</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">
                                                No items added yet. Search and add items above.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        selectedItems.map(item => {
                                            const line = item.quantity * item.unitPrice;
                                            const lineTotal = line - line * (item.discountRate / 100) + (line - line * (item.discountRate / 100)) * (item.taxRate / 100);
                                            return (
                                                <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-mono text-xs font-semibold">{item.sku}</TableCell>
                                                    <TableCell>
                                                        <span className="text-sm font-medium">{item.description}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                            className="h-8 w-20 focus-visible:ring-primary shadow-none bg-transparent group-hover:bg-background transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.unitPrice}
                                                            onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                            className="h-8 focus-visible:ring-primary shadow-none bg-transparent group-hover:bg-background transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.01"
                                                            value={item.taxRate}
                                                            onChange={e => updateItem(item.id, 'taxRate', Number(e.target.value))}
                                                            className="h-8 focus-visible:ring-primary shadow-none bg-transparent group-hover:bg-background transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.01"
                                                            value={item.discountRate}
                                                            onChange={e => updateItem(item.id, 'discountRate', Number(e.target.value))}
                                                            className="h-8 focus-visible:ring-primary shadow-none bg-transparent group-hover:bg-background transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-sm">
                                                        {lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                            onClick={() => removeItem(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </PermissionGuard>
    );
}
