'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { createPurchaseRequisition } from '@/lib/actions/purchase-requisition';
import { getItems } from '@/lib/actions/items';
import { getDepartments, getSubDepartments, type Department, type SubDepartment } from '@/lib/actions/department';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Trash2, Search, CheckCircle2, Plus, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { authFetch } from '@/lib/auth';
import { inventoryApi } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PermissionGuard } from '@/components/auth/permission-guard';

interface FormValues {
    department: string;
    requestDate: string;
    notes: string;
    type?: string;
    goodsType?: string; // CONSUMABLE, FRESH
    items: {
        itemId: string;
        requiredQty: number;
    }[];
}

interface Item {
    id: string;
    itemId: string;
    sku: string;
    description?: string;
}

export default function CreatePurchaseRequisition() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState<string>('');
    const [prAutoNumber] = useState<string>('Auto'); // display-only
    
    // Item search state — Popover multi-select (same as stock-transfer)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [bulkQty, setBulkQty] = useState<number>(1);
    const [addedItems, setAddedItems] = useState<{ id: string; itemId: string; sku: string; description: string; requiredQty: number }[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Default values
    const { control, register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
        defaultValues: {
            department: '',
            requestDate: new Date().toISOString().split('T')[0],
            type: 'local',
            goodsType: 'CONSUMABLE', // Default to CONSUMABLE
            items: []
        }
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingItems(true);
                const response = await getItems();
                if (response.status) {
                    setItems(response.data);
                }
                const [deptRes, subDeptRes] = await Promise.all([
                    getDepartments(),
                    getSubDepartments(),
                ]);
                setDepartments(deptRes.data || []);
                setSubDepartments(subDeptRes.data || []);
            } catch (error) {
                console.error("Failed to fetch items", error);
                toast.error("Failed to load items");
            } finally {
                setLoadingItems(false);
            }
        };
        fetchData();
    }, []);

    // Auto-focus search input on mount
    useEffect(() => {
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

    const toggleItem = useCallback((itemData: any) => {
        const exists = addedItems.find(i => i.id === itemData.id);
        if (exists) {
            setAddedItems(prev => prev.filter(i => i.id !== itemData.id));
        } else {
            if (bulkQty <= 0) { toast.error('Quantity must be greater than 0'); return; }
            setAddedItems(prev => [...prev, {
                id: itemData.id,
                itemId: itemData.itemId || itemData.id,
                sku: itemData.sku,
                description: itemData.description,
                requiredQty: bulkQty,
            }]);
        }
    }, [addedItems, bulkQty]);

    const handleUpdateQuantity = useCallback((id: string, newQty: number) => {
        if (newQty <= 0) { toast.error('Quantity must be greater than 0'); return; }
        setAddedItems(prev => prev.map(item => item.id === id ? { ...item, requiredQty: newQty } : item));
    }, []);

    const handleRemoveItem = useCallback((id: string) => {
        setAddedItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const onSubmit = async (data: FormValues) => {
        try {
            setLoading(true);
            
            if (addedItems.length === 0) {
                toast.error('Please add at least one item');
                setLoading(false);
                return;
            }

            const pr = await createPurchaseRequisition({
                ...data,
                items: addedItems.map(item => ({
                    itemId: item.id, // Fix: Send the UUID instead of the short string ID
                    requiredQty: item.requiredQty,
                })),
            });
            toast.success('Purchase Requisition submitted for approval');
            router.push(`/erp/procurement/purchase-requisition/${pr?.data?.id ?? pr?.id}`);
        } catch (error) {
            console.error(error);
            toast.error('Failed to create requisition');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.pr.create">
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Create Requisition</h1>
                <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Requisition Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="prNumber">PR No</Label>
                            <Input id="prNumber" value={prAutoNumber} disabled />
                        </div>

                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select
                                value={selectedDepartmentId}
                                onValueChange={(val) => {
                                    setSelectedDepartmentId(val);
                                    const deptName = departments.find(d => d.id === val)?.name || '';
                                    setValue('department', deptName);
                                    setSelectedSubDepartmentId('');
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Sub Department</Label>
                            <Select
                                value={selectedSubDepartmentId}
                                onValueChange={(val) => {
                                    setSelectedSubDepartmentId(val);
                                    const subName = subDepartments.find(s => s.id === val)?.name || '';
                                    setValue('department', subName || (departments.find(d => d.id === selectedDepartmentId)?.name || ''));
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Sub Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subDepartments.filter(s => s.departmentId === selectedDepartmentId).map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="requestDate">Request Date</Label>
                            <Controller
                                control={control}
                                name="requestDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Pick a date"
                                    />
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Controller
                                control={control}
                                name="type"
                                render={({ field }) => (
                                    <Select value={field.value || ''} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="local">Local</SelectItem>
                                            <SelectItem value="import">Import</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Goods Type</Label>
                            <Controller
                                control={control}
                                name="goodsType"
                                render={({ field }) => (
                                    <Select value={field.value || ''} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Goods Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                                            <SelectItem value="FRESH">FINISH GOODS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" {...register('notes')} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Add Items</span>
                            {addedItems.length > 0 && <Badge variant="secondary">{addedItems.length} selected</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3 items-end p-4 bg-primary/5 rounded-lg border border-primary/10">
                            {/* Bulk Qty */}
                            <div className="w-28 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Bulk Qty</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={bulkQty}
                                    onChange={(e) => setBulkQty(Number(e.target.value))}
                                    className="h-10 border-primary/20"
                                />
                            </div>

                            {/* Search Popover */}
                            <div className="flex-1 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Search Items (Select Multiple)</Label>
                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                ref={searchInputRef}
                                                placeholder="Type SKU or description to search…"
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
                                            <CommandList className="max-h-[350px]">
                                                {searchResults.length === 0 ? (
                                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                                        {isSearching ? 'Searching…' : searchQuery.length > 0 ? `No items match "${searchQuery}"` : 'Type at least 2 characters to search'}
                                                    </div>
                                                ) : (
                                                    <CommandGroup>
                                                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-muted/50">
                                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Results ({searchResults.length})</span>
                                                            <button type="button" className="text-xs text-primary underline underline-offset-2"
                                                                onClick={() => searchResults.filter((o: any) => !addedItems.find(a => a.id === o.item.id)).forEach((o: any) => toggleItem(o.item))}>
                                                                Select all
                                                            </button>
                                                        </div>
                                                        <ScrollArea className="h-[280px]">
                                                            {searchResults.map((opt: any) => {
                                                                const item = opt.item;
                                                                const isSelected = addedItems.some(a => a.id === item.id);
                                                                return (
                                                                    <CommandItem key={item.id} value={`${item.sku} ${item.description}`} onSelect={() => toggleItem(item)}
                                                                        className={cn("flex items-center justify-between gap-3 px-4 py-3 cursor-pointer border-b border-muted/50 last:border-0",
                                                                            isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-accent")}>
                                                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded border font-bold",
                                                                                    isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-muted-foreground/20")}>
                                                                                    {item.sku}
                                                                                </span>
                                                                                <span className={cn("truncate text-sm", isSelected ? "font-bold text-primary" : "font-medium")}>{item.description}</span>
                                                                            </div>
                                                                            <span className="text-[11px] text-muted-foreground">Stock: <span className={cn("font-bold", item.availableStock > 0 ? "text-foreground" : "text-destructive")}>{item.availableStock ?? 0}</span></span>
                                                                        </div>
                                                                        <div className="shrink-0">
                                                                            {isSelected ? <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" /> : <Plus className="h-4 w-4 text-muted-foreground opacity-50" />}
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
                        <p className="text-xs text-muted-foreground italic flex items-center gap-1.5 px-1">
                            <span className="text-primary">ℹ</span> Click items to toggle selection. Popover stays open for multiple selects.
                        </p>
                    </CardContent>
                </Card>

                {/* Added Items List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Added Items ({addedItems.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {addedItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No items added yet. Search and select items above.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {addedItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{item.description}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-none">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-sm">Qty:</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={item.requiredQty}
                                                    onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                                    className="w-20 h-8 text-sm"
                                                />
                                            </div>
                                            <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveItem(item.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit'}
                    </Button>
                </div>
            </form>
        </div>
        </PermissionGuard>
    );
}
