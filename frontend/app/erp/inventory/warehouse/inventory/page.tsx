"use client";

import { useState, useEffect, useMemo } from "react";
import { stockLedgerApi, StockLevel, warehouseApi, Warehouse, inventoryApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Store, Package, Boxes, Building2, MapPin, Loader2, ChevronRight } from "lucide-react";
import { ListError } from "@/components/dashboard/list-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PermissionGuard } from "@/components/auth/permission-guard";

interface GroupedItem {
    itemId: string;
    sku: string;
    itemCode: string;
    description: string;
    totalQty: number;
    warehouseQty: number;
    locationQty: number;
    rows: StockLevel[];
}

// ── Stock Breakdown Sheet ──────────────────────────────────────────────────────

function StockBreakdownSheet({ item, onClose }: { item: GroupedItem | null; onClose: () => void }) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!item) return;
        setLoading(true);
        inventoryApi.getDetails(item.itemId)
            .then(res => { if (res.status) setDetails(res.data); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [item?.itemId]);

    return (
        <Sheet open={!!item} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-md flex flex-col p-0 border-l border-border/50 gap-0">
                <SheetHeader className="p-6 border-b bg-muted/30">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Package className="w-5 h-5" />
                        </div>
                        <SheetTitle className="text-xl font-bold tracking-tight">Stock Breakdown</SheetTitle>
                    </div>
                    <SheetDescription className="font-medium">
                        <span className="font-bold text-foreground">{item?.sku}</span>
                        <br />
                        <span className="text-muted-foreground">{item?.description}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="px-5 py-3 bg-primary/5 border-b border-border/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Total Stock</span>
                    <Badge className="font-mono text-xs px-3">{item?.totalQty.toLocaleString()} Units</Badge>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-4 flex flex-col gap-3">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/50">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <p className="text-xs font-medium">Loading breakdown...</p>
                            </div>
                        ) : details.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">No stock records found</p>
                            </div>
                        ) : (
                            details.map((entry: any) => (
                                <div
                                    key={entry.id}
                                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-3 items-center">
                                            <div className="p-2 bg-muted rounded-lg">
                                                {entry.locationId
                                                    ? <Store className="w-4 h-4 text-green-500" />
                                                    : <Building2 className="w-4 h-4 text-indigo-400" />
                                                }
                                            </div>
                                            <div>
                                                {entry.locationId ? (
                                                    <>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-bold text-sm">{entry.location?.name}</p>
                                                            {entry.location?.code && (
                                                                <Badge variant="outline" className="font-mono text-[10px] h-4 px-1">{entry.location.code}</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                            <Building2 className="h-3 w-3 text-primary/50" />
                                                            {entry.location?.warehouse?.name}
                                                            {entry.location?.type && (
                                                                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{entry.location.type}</Badge>
                                                            )}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-bold text-sm">{entry.location?.warehouse?.name || "Warehouse"}</p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                            <MapPin className="h-3 w-3 text-primary/50" />
                                                            Main Stock
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <Badge
                                            variant={Number(entry.quantity) > 0 ? "default" : "secondary"}
                                            className="font-mono text-xs"
                                        >
                                            {Number(entry.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Badge>
                                    </div>
                                    {entry.batchNumber && (
                                        <>
                                            <Separator className="my-2 opacity-30" />
                                            <p className="text-[10px] text-muted-foreground">
                                                Batch: <span className="font-mono font-semibold">{entry.batchNumber}</span>
                                            </p>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
    const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
    const [selectedLocation, setSelectedLocation] = useState<string>("all");
    const [selectedItem, setSelectedItem] = useState<GroupedItem | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [stockData, warehouseData] = await Promise.all([
                stockLedgerApi.getLevels(),
                warehouseApi.getAll(),
            ]);
            setStockLevels(Array.isArray(stockData) ? stockData : (stockData as any).data || []);
            setWarehouses(warehouseData);
        } catch {
            setError("Failed to load inventory data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Unique locations from data (only outlet locations, not warehouse bulk)
    const locations = useMemo(() => {
        const map = new Map<string, { id: string; name: string; code: string; type: string }>();
        stockLevels.forEach(l => {
            if (l.locationId && l.location && !map.has(l.locationId)) {
                map.set(l.locationId, {
                    id: l.locationId,
                    name: l.location.name,
                    code: l.location.code,
                    type: l.location.type,
                });
            }
        });
        return Array.from(map.values());
    }, [stockLevels]);

    // Group by itemId
    const groupedItems = useMemo<GroupedItem[]>(() => {
        const map = new Map<string, GroupedItem & { warehouseNames: string[] }>();
        stockLevels.forEach(level => {
            const qty = Number(level.totalQty);
            const existing = map.get(level.itemId);
            if (existing) {
                existing.totalQty += qty;
                if (!level.locationId) existing.warehouseQty += qty;
                else existing.locationQty += qty;
                if (level.warehouse?.name && !existing.warehouseNames.includes(level.warehouse.name))
                    existing.warehouseNames.push(level.warehouse.name);
                existing.rows.push(level);
            } else {
                map.set(level.itemId, {
                    itemId: level.itemId,
                    sku: level.item?.sku || "N/A",
                    itemCode: level.item?.itemId || "",
                    description: level.item?.description || "-",
                    totalQty: qty,
                    warehouseQty: !level.locationId ? qty : 0,
                    locationQty: level.locationId ? qty : 0,
                    warehouseNames: level.warehouse?.name ? [level.warehouse.name] : [],
                    rows: [level],
                });
            }
        });
        return Array.from(map.values());
    }, [stockLevels]);

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return groupedItems.filter(item => {
            const matchesSearch =
                item.sku.toLowerCase().includes(query) ||
                item.itemCode.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query);

            const matchesWarehouse =
                selectedWarehouse === "all" ||
                item.rows.some(r => r.warehouseId === selectedWarehouse);

            const matchesLocation =
                selectedLocation === "all" ? true
                    : selectedLocation === "__warehouse__"
                    ? item.rows.some(r => !r.locationId)
                    : item.rows.some(r => r.locationId === selectedLocation);

            return matchesSearch && matchesWarehouse && matchesLocation;
        });
    }, [groupedItems, searchQuery, selectedWarehouse, selectedLocation]);

    const summary = useMemo(() => {
        let warehouseQty = 0, locationQty = 0;
        stockLevels.forEach(l => {
            if (!l.locationId) warehouseQty += Number(l.totalQty);
            else locationQty += Number(l.totalQty);
        });
        return { warehouseQty, locationQty, uniqueItems: groupedItems.length };
    }, [stockLevels, groupedItems]);

    if (error) return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <ListError title="Error loading inventory" message={error} />
        </div>
    );

    return (
        <PermissionGuard permissions="erp.inventory.warehouse.inventory.view">
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Inventory List</h2>
                <p className="text-sm text-muted-foreground">Grouped by item — click any row for breakdown</p>
            </div>

            {!loading && (
                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100"><Boxes className="h-5 w-5 text-blue-600" /></div>
                            <div>
                                <p className="text-xs text-muted-foreground">Unique Items</p>
                                <p className="text-2xl font-bold">{summary.uniqueItems}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-100"><Package className="h-5 w-5 text-indigo-600" /></div>
                            <div>
                                <p className="text-xs text-muted-foreground">Warehouse Stock</p>
                                <p className="text-2xl font-bold">{summary.warehouseQty.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100"><Store className="h-5 w-5 text-green-600" /></div>
                            <div>
                                <p className="text-xs text-muted-foreground">Location Stock</p>
                                <p className="text-2xl font-bold">{summary.locationQty.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        <CardTitle>Current Stock Levels</CardTitle>
                        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="All Warehouses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Warehouses</SelectItem>
                                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                <SelectTrigger className="w-full md:w-[220px]">
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations</SelectItem>
                                    <SelectItem value="__warehouse__">Warehouse (Bulk)</SelectItem>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            {loc.name}
                                            <span className="ml-1.5 text-muted-foreground font-mono text-[11px]">({loc.code})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Code / SKU</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Warehouse Qty</TableHead>
                                <TableHead className="text-right">Location Qty</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Loading inventory...</TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No inventory found.</TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map(item => (
                                    <TableRow
                                        key={item.itemId}
                                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                                        onClick={() => setSelectedItem(item)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{item.sku}</span>
                                                <span className="text-xs text-muted-foreground">{item.itemCode}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                                            {item.description}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm text-indigo-600 font-semibold">
                                            {item.warehouseQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm text-green-600 font-semibold">
                                            {item.locationQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-base">
                                            {item.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.totalQty > 0 ? (
                                                <Badge className="bg-green-500">In Stock</Badge>
                                            ) : item.totalQty < 0 ? (
                                                <Badge variant="destructive">Negative</Badge>
                                            ) : (
                                                <Badge variant="secondary">Out of Stock</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    {!loading && filteredItems.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-3 text-right">
                            Showing {filteredItems.length} of {groupedItems.length} items
                        </p>
                    )}
                </CardContent>
            </Card>

            <StockBreakdownSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
        </div>
        </PermissionGuard>
    );
}
