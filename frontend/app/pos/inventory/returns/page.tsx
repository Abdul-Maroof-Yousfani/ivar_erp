"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    RotateCcw,
    ArrowLeft,
    RefreshCcw,
    Package,
    CheckCircle2,
    FileText,
    AlertTriangle,
    Plus,
    Minus,
    Trash2,
    Search,
    Send,
    ShoppingCart,
    Building2,
    Scan,
    Barcode,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/providers/auth-provider";
import { getReturnTransferRequests, acceptTransferRequest, createReturnTransferRequest } from "@/lib/actions/transfer-request";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { warehouseApi, inventoryApi } from "@/lib/api";

interface Warehouse {
    id: string;
    name: string;
    isActive: boolean;
}

interface Item {
    id: string;
    sku: string;
    description: string;
    size?: { id: string; name: string };
    color?: { id: string; name: string };
    totalQuantity: number;
}

interface CartItem {
    item: Item;
    quantity: number;
}

interface RequestItem {
    id: string;
    quantity: number;
    item?: {
        sku: string;
        description: string;
    };
}

interface ReturnRequest {
    id: string;
    requestNo: string;
    status: string;
    createdAt: string;
    notes?: string;
    fromWarehouse?: {
        name: string;
    };
    items: RequestItem[];
}

export default function ReturnRequestsPage() {
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<ReturnRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);

    // Create Mode States
    const [isCreating, setIsCreating] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [itemQuery, setItemQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Item[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Barcode Scanner State
    const [scanInput, setScanInput] = useState('');
    const scannerInputRef = React.useRef<HTMLInputElement>(null);

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
            osc.frequency.setValueAtTime(1050, audioCtx.currentTime); // Crisp beep
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
            osc1.frequency.setValueAtTime(140, audioCtx.currentTime); // Error buzz
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

    // Auto-focus scanner on create mode open
    useEffect(() => {
        if (isCreating) {
            const timer = setTimeout(() => {
                scannerInputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isCreating]);

    // Keyboard shortcut F2 to focus scanner input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2' && isCreating) {
                e.preventDefault();
                scannerInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCreating]);

    const locationId = user?.terminal?.location?.id || user?.locationId;
    const debouncedQuery = useDebounce(itemQuery, 300);

    const handleScanToAdd = async (barcodeVal: string) => {
        const code = barcodeVal.trim();
        if (!code) return;
        if (!locationId) {
            playScanErrorBuzz();
            toast.error("Outlet location is not configured");
            return;
        }

        setIsSearching(true);
        try {
            const res = await inventoryApi.search(code, undefined, locationId);
            if (res.status && res.data && res.data.length > 0) {
                const cleanedCode = code.toLowerCase();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let matched = res.data.find((item: any) => 
                    (item.sku && item.sku.toLowerCase() === cleanedCode) ||
                    (item.barcode && item.barcode.toLowerCase() === cleanedCode) ||
                    (item.barCode && item.barCode.toLowerCase() === cleanedCode) ||
                    (item.code && item.code.toLowerCase() === cleanedCode) ||
                    (item.id && item.id.toLowerCase() === cleanedCode)
                );

                if (!matched && res.data.length === 1) {
                    matched = res.data[0];
                }

                if (matched) {
                    const totalQty = matched.totalQuantity || 0;
                    if (totalQty <= 0) {
                        playScanErrorBuzz();
                        toast.error(`Item "${matched.description || matched.sku}" has 0 available stock at this outlet.`);
                        setScanInput('');
                        return;
                    }

                    const itemToAdd: Item = {
                        id: matched.id,
                        sku: matched.sku,
                        description: matched.description,
                        size: matched.size,
                        color: matched.color,
                        totalQuantity: totalQty,
                    };

                    const existingInCart = cart.find(c => c.item.id === matched.id);
                    const currentQty = existingInCart ? existingInCart.quantity : 0;

                    if (currentQty >= totalQty) {
                        playScanErrorBuzz();
                        toast.warning(`Cannot add more than available outlet stock (${totalQty}) for ${matched.sku}`);
                        setScanInput('');
                        return;
                    }

                    playScanSuccessBeep();
                    addToCart(itemToAdd);
                    toast.success(`+1 Scanned & Added: ${itemToAdd.description || itemToAdd.sku}`);
                } else {
                    playScanErrorBuzz();
                    toast.warning(`Multiple items found for "${code}". Please select from search results.`);
                    setItemQuery(code);
                }
            } else {
                playScanErrorBuzz();
                toast.error(`No item found matching Barcode/SKU: "${code}" in outlet stock.`);
            }
        } catch (error) {
            console.error("Failed to scan item", error);
            playScanErrorBuzz();
            toast.error(`Error scanning barcode "${code}"`);
        } finally {
            setIsSearching(false);
            setScanInput('');
        }
    };

    const fetchRequests = useCallback(async () => {
        if (!locationId) return;
        setIsLoading(true);
        try {
            const res = await getReturnTransferRequests(locationId);
            if (res.status) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mappedRequests = (res.data || []).map((req: any) => ({
                    id: req.id,
                    requestNo: req.requestNo,
                    status: req.status,
                    createdAt: req.createdAt,
                    notes: req.notes,
                    fromWarehouse: req.fromWarehouse ? { name: req.fromWarehouse.name } : undefined,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    items: (req.items || []).map((it: any) => ({
                        id: it.id,
                        quantity: Number(it.quantity || 0),
                        item: it.item ? { sku: it.item.sku, description: it.item.description } : undefined
                    }))
                }));
                setRequests(mappedRequests);
            }
        } catch (error) {
            console.error("Failed to fetch return requests", error);
            toast.error("Failed to load return requests");
        } finally {
            setIsLoading(false);
        }
    }, [locationId]);

    const fetchWarehouses = useCallback(async () => {
        try {
            const res = await warehouseApi.getAll();
            const activeWhs = res.filter((w) => w.isActive);
            setWarehouses(activeWhs);
            if (activeWhs.length > 0) {
                setSelectedWarehouseId(activeWhs[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch warehouses", error);
            toast.error("Failed to load destination warehouses");
        }
    }, []);

    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim() || !locationId) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await inventoryApi.search(query, undefined, locationId);
            if (res.status) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const availableItems = (res.data || []).map((item: any) => ({
                    id: item.id,
                    sku: item.sku,
                    description: item.description,
                    size: item.size,
                    color: item.color,
                    totalQuantity: item.totalQuantity || 0
                })).filter((item) => item.totalQuantity > 0);
                setSearchResults(availableItems);
            }
        } catch (error) {
            console.error("Failed to search inventory", error);
        } finally {
            setIsSearching(false);
        }
    }, [locationId]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    useEffect(() => {
        if (isCreating) {
            fetchWarehouses();
        }
    }, [isCreating, fetchWarehouses]);

    useEffect(() => {
        if (isCreating) {
            handleSearch(debouncedQuery);
        }
    }, [debouncedQuery, isCreating, handleSearch]);

    const addToCart = (item: Item) => {
        setCart(prev => {
            const existing = prev.find(i => i.item.id === item.id);
            if (existing) {
                if (existing.quantity >= item.totalQuantity) {
                    toast.warning(`Cannot add more than available stock (${item.totalQuantity})`);
                    return prev;
                }
                return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { item, quantity: 1 }];
        });
        setItemQuery('');
        setSearchResults([]);
    };

    const updateCartQuantity = (itemId: string, newQty: number) => {
        setCart(prev => prev.map(i => {
            if (i.item.id === itemId) {
                const maxStock = i.item.totalQuantity;
                const validatedQty = Math.max(1, Math.min(maxStock, newQty));
                return { ...i, quantity: validatedQty };
            }
            return i;
        }));
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => prev.filter(i => i.item.id !== itemId));
    };

    const handleSubmitReturn = async () => {
        if (!locationId) {
            toast.error("Your terminal/outlet location is not configured");
            return;
        }
        if (!selectedWarehouseId) {
            toast.error("Please select a destination warehouse");
            return;
        }
        if (cart.length === 0) {
            toast.error("Please add at least one item to return");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await createReturnTransferRequest({
                fromLocationId: locationId,
                fromWarehouseId: selectedWarehouseId,
                items: cart.map(i => ({
                    itemId: i.item.id,
                    quantity: i.quantity
                })),
                notes: notes,
                createdById: user?.id
            });
            if (res.status) {
                toast.success("Return request submitted successfully! Awaiting approval.");
                setIsCreating(false);
                setCart([]);
                setNotes('');
                fetchRequests();
            } else {
                toast.error(res.message || "Failed to submit return request");
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || "Failed to submit return request");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAccept = async (requestId: string) => {
        setIsAccepting(requestId);
        try {
            const res = await acceptTransferRequest(requestId, user?.id);
            if (res.status) {
                toast.success("Return request approved! Items returned to warehouse.");
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                toast.error(res.message || "Failed to approve return");
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || "Failed to approve return");
        } finally {
            setIsAccepting(null);
        }
    };

    if (isCreating) {
        return (
            <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
                {/* Header */}
                <header className="flex-none p-4 md:p-6 border-b bg-muted/20 backdrop-blur-xl sticky top-0 z-10 border-border/50">
                    <div className="flex items-center gap-4 max-w-5xl mx-auto w-full">
                        <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold tracking-tight">Create Return Request</h1>
                            <div className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                                Return items from
                                <Badge variant="outline" className="font-bold text-orange-600 border-orange-200 bg-orange-50">
                                    {user?.terminal?.location?.name || "This Location"}
                                </Badge>
                                to a warehouse
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Form */}
                <main className="flex-1 p-4 md:p-6 pb-20 overflow-auto">
                    <div className="max-w-5xl mx-auto w-full">
                        {/* Barcode / SKU Scan-to-Add Input Bar */}
                        <Card className="border-orange-500/30 bg-orange-500/5 shadow-sm mb-6">
                            <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
                                <div className="flex items-center gap-2 font-bold text-sm text-orange-700 dark:text-orange-300 shrink-0">
                                    <Scan className="h-5 w-5 text-orange-600 animate-pulse" />
                                    Scan to Add Item:
                                </div>
                                <div className="flex-1 flex items-center gap-2 w-full">
                                    <div className="relative flex-1">
                                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            ref={scannerInputRef}
                                            placeholder="Scan Item Barcode / SKU (or press F2 to focus)..."
                                            value={scanInput}
                                            onChange={(e) => setScanInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleScanToAdd(scanInput);
                                                }
                                            }}
                                            className="pl-9 pr-8 font-mono text-xs sm:text-sm bg-background border-orange-500/30 focus-visible:ring-orange-500 h-10 shadow-xs"
                                        />
                                        {scanInput && (
                                            <button
                                                type="button"
                                                onClick={() => setScanInput("")}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={() => handleScanToAdd(scanInput)}
                                        disabled={isSearching}
                                        className="font-bold h-10 gap-1.5 bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-sm"
                                    >
                                        <Barcode className="h-4 w-4" />
                                        {isSearching ? "Searching..." : "Scan & Add"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        {/* Left Column: Warehouse Selection & Item Search */}
                        <div className="md:col-span-2 space-y-6">
                            {/* Warehouse Selection Card */}
                            <Card className="border-border/50 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-md font-bold flex items-center gap-2 text-foreground">
                                        <Building2 className="h-5 w-5 text-orange-600" />
                                        Destination Warehouse
                                    </CardTitle>
                                    <CardDescription className="text-xs">Select the warehouse to return stock to.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <Label htmlFor="warehouse-select" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Warehouse</Label>
                                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                                            <SelectTrigger id="warehouse-select" className="h-11 bg-muted/30">
                                                <SelectValue placeholder="Select Destination Warehouse" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map(w => (
                                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Item Search Card */}
                            <Card className="border-border/50 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-md font-bold flex items-center gap-2 text-foreground">
                                        <Search className="h-5 w-5 text-orange-600" />
                                        Search Items
                                    </CardTitle>
                                    <CardDescription className="text-xs">Find items with available stock at this outlet.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                        <Input
                                            placeholder="Search by SKU or description..."
                                            value={itemQuery}
                                            onChange={(e) => setItemQuery(e.target.value)}
                                            className="pl-9 h-11 bg-muted/20 border-border/50"
                                        />
                                    </div>

                                    {/* Search Results */}
                                    <ScrollArea className="h-[250px] rounded-lg border border-border/50 bg-muted/5">
                                        {isSearching ? (
                                            <div className="p-4 space-y-2">
                                                {[1, 2, 3].map(i => (
                                                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                                                ))}
                                            </div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                                                <Package className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    {itemQuery ? "No matching items with stock found" : "Type to search available stock"}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border/50">
                                                {searchResults.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => addToCart(item)}
                                                        className="w-full text-left p-3 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors flex items-center justify-between gap-4 group"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center flex-wrap gap-1.5 mb-1">
                                                                <span className="font-mono text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground group-hover:bg-orange-100 group-hover:text-orange-700 dark:group-hover:bg-orange-950/40 dark:group-hover:text-orange-300 transition-colors">
                                                                    {item.sku}
                                                                </span>
                                                                {item.size?.name && (
                                                                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-medium">
                                                                        Size: {item.size.name}
                                                                    </Badge>
                                                                )}
                                                                {item.color?.name && (
                                                                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-medium">
                                                                        Color: {item.color.name}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-semibold truncate text-foreground">{item.description}</p>
                                                        </div>
                                                        <div className="text-right flex-none">
                                                            <span className="text-[9px] block font-bold text-muted-foreground uppercase tracking-wider">Available</span>
                                                            <span className="text-xs font-bold text-emerald-600">{item.totalQuantity} units</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Return Cart */}
                        <div className="md:col-span-3">
                            <Card className="border-border/50 shadow-sm h-full flex flex-col min-h-[450px]">
                                <CardHeader className="pb-4 border-b border-border/50 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-md font-bold flex items-center gap-2 text-foreground">
                                            <ShoppingCart className="h-5 w-5 text-orange-600" />
                                            Return List
                                        </CardTitle>
                                        <CardDescription className="text-xs">Items selected for return.</CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 dark:bg-orange-950/40 dark:text-orange-300 font-bold">
                                        {cart.length} {cart.length === 1 ? 'item' : 'items'}
                                    </Badge>
                                </CardHeader>

                                <div className="flex-1 flex flex-col justify-between">
                                    {/* Cart Items */}
                                    <ScrollArea className="flex-1 max-h-[300px]">
                                        {cart.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-center p-6">
                                                <ShoppingCart className="h-12 w-12 text-muted-foreground/20 mb-3" />
                                                <h4 className="font-bold text-muted-foreground text-sm">Return List is Empty</h4>
                                                <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">
                                                    Search and select items on the left to add them to your return request.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border/50">
                                                {cart.map(({ item, quantity }) => (
                                                    <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-mono text-xs font-bold text-orange-600 mb-0.5">{item.sku}</p>
                                                            <h4 className="text-sm font-semibold text-foreground truncate">{item.description}</h4>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                {item.size?.name && (
                                                                    <span className="text-[10px] text-muted-foreground">Size: <span className="font-bold text-foreground">{item.size.name}</span></span>
                                                                )}
                                                                {item.color?.name && (
                                                                    <span className="text-[10px] text-muted-foreground">Color: <span className="font-bold text-foreground">{item.color.name}</span></span>
                                                                )}
                                                                <span className="text-[10px] text-muted-foreground">Available: <span className="font-bold text-emerald-600">{item.totalQuantity}</span></span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4 flex-none">
                                                            {/* Quantity Selector */}
                                                            <div className="flex items-center border border-border/50 rounded-lg overflow-hidden bg-background shadow-sm h-9">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-full w-8 rounded-none border-r border-border/50 hover:bg-muted"
                                                                    onClick={() => updateCartQuantity(item.id, quantity - 1)}
                                                                    disabled={quantity <= 1}
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <span className="w-10 text-center font-mono text-xs font-bold">{quantity}</span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-full w-8 rounded-none border-l border-border/50 hover:bg-muted"
                                                                    onClick={() => updateCartQuantity(item.id, quantity + 1)}
                                                                    disabled={quantity >= item.totalQuantity}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>

                                                            {/* Delete Button */}
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9 rounded-lg"
                                                                onClick={() => removeFromCart(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>

                                    {/* Footer & Notes */}
                                    <div className="p-4 md:p-6 border-t border-border/50 bg-muted/5 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="return-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Return Reason / Notes</Label>
                                            <Textarea
                                                id="return-notes"
                                                placeholder="Specify the reason for returning these items..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                rows={2}
                                                className="bg-background resize-none border-border/50"
                                            />
                                        </div>

                                        <Button
                                            onClick={handleSubmitReturn}
                                            className="w-full h-12 text-md font-bold gap-2 shadow-lg shadow-orange-100 dark:shadow-none bg-orange-600 hover:bg-orange-700 text-white"
                                            disabled={isSubmitting || cart.length === 0}
                                        >
                                            {isSubmitting ? (
                                                <RefreshCcw className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <Send className="h-5 w-5" />
                                            )}
                                            {isSubmitting ? "Submitting..." : "Submit Return Request"}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
            {/* Header */}
            <header className="flex-none p-4 md:p-6 border-b bg-muted/20 backdrop-blur-xl sticky top-0 z-10 border-border/50">
                <div className="flex items-center gap-4 max-w-5xl mx-auto w-full">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight">Return Requests</h1>
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                            Approve return requests to send items back to warehouse from
                            <Badge variant="outline" className="ml-1 font-bold text-orange-600 border-orange-200 bg-orange-50">
                                {user?.terminal?.location?.name || "This Location"}
                            </Badge>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchRequests} disabled={isLoading} className="border-border/50">
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    {(hasPermission('pos.inventory.transfer.create') || hasPermission('erp.inventory.transfer.create')) && (
                        <Button
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                            onClick={() => setIsCreating(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" /> New Return
                        </Button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 pb-20 overflow-auto">
                <div className="max-w-5xl mx-auto w-full space-y-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : requests.length === 0 ? (
                        <Card className="border-dashed h-[400px] flex flex-col items-center justify-center text-center p-8 bg-muted/5 border-border/50">
                            <div className="h-20 w-20 rounded-full bg-orange-100 dark:bg-orange-950/20 flex items-center justify-center mb-4">
                                <RotateCcw className="h-10 w-10 text-orange-600/60" />
                            </div>
                            <CardTitle className="text-xl mb-2 text-muted-foreground">No Return Requests</CardTitle>
                            <CardDescription className="max-w-xs mx-auto">
                                No pending return requests for this location. Click &quot;New Return&quot; to create one.
                            </CardDescription>
                            <div className="flex gap-3 mt-6">
                                <Button variant="outline" onClick={fetchRequests} className="border-border/50">
                                    <RefreshCcw className="h-4 w-4 mr-2" /> Check Again
                                </Button>
                                {(hasPermission('pos.inventory.transfer.create') || hasPermission('erp.inventory.transfer.create')) && (
                                    <Button
                                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                                        onClick={() => setIsCreating(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" /> New Return
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {requests.map((request) => (
                                <Card key={request.id} className="overflow-hidden border-border/50 hover:border-orange-200 dark:hover:border-orange-950 transition-all shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-stretch">
                                        {/* Status Sidebar */}
                                        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 md:w-48 flex flex-col justify-between border-b md:border-b-0 md:border-r border-orange-100 dark:border-orange-950">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">Return Request</span>
                                                <div className="font-mono text-sm font-bold truncate text-orange-800 dark:text-orange-300">{request.requestNo}</div>
                                            </div>
                                            <div className="mt-4 md:mt-0">
                                                {request.status === 'APPROVED' ? (
                                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900">
                                                        <AlertTriangle className="h-3 w-3 mr-1" /> Pending Approval
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <CardContent className="p-4 md:p-6 flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex-1 w-full space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-orange-100 dark:bg-orange-950/30 p-2 rounded-lg text-orange-600 flex-none">
                                                        <RotateCcw className="h-6 w-6" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-bold text-lg leading-tight truncate">
                                                            {request.items.length > 1
                                                                ? `Multiple Items (${request.items.length})`
                                                                : request.items[0]?.item?.description || "Return Items"}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground font-medium truncate">
                                                            {request.items.length > 1
                                                                ? `SKU: ${request.items[0]?.item?.sku || 'N/A'} and ${request.items.length - 1} more`
                                                                : `SKU: ${request.items[0]?.item?.sku || "N/A"}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Return Quantity</span>
                                                        <span className="text-xl font-black text-orange-600">
                                                            {request.items.reduce((acc: number, item) => acc + Number(item.quantity || 0), 0)}
                                                        </span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Destination</span>
                                                        <span className="text-sm font-semibold">{request.fromWarehouse?.name || "Main Warehouse"}</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Request Date</span>
                                                        <span className="text-sm font-semibold">{format(new Date(request.createdAt), "dd MMM yyyy HH:mm")}</span>
                                                    </div>
                                                </div>

                                                {request.notes && (
                                                    <div className="bg-orange-50 dark:bg-orange-950/10 p-3 rounded-lg border border-orange-100 dark:border-orange-900/50">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 block mb-1">Return Reason</span>
                                                        <p className="text-sm text-orange-800 dark:text-orange-300">{request.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full md:w-auto flex flex-col gap-2 flex-none">
                                                <Button
                                                    className="w-full md:w-40 h-14 text-lg font-bold gap-2 shadow-lg shadow-orange-100 dark:shadow-none bg-orange-600 hover:bg-orange-700 text-white"
                                                    disabled={isAccepting === request.id || !hasPermission('pos.inventory.returns.approve')}
                                                    onClick={() => handleAccept(request.id)}
                                                >
                                                    {isAccepting === request.id ? (
                                                        <RefreshCcw className="h-5 w-5 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    )}
                                                    {isAccepting === request.id ? "Approving..." : "Approve Return"}
                                                </Button>
                                                <Button variant="outline" className="w-full md:w-40 h-10 font-semibold text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-950/20" asChild>
                                                    <Link href={`/erp/inventory/transactions/return-transfer/slip/${request.id}`} target="_blank">
                                                        <FileText className="h-4 w-4 mr-2" /> View Details
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}