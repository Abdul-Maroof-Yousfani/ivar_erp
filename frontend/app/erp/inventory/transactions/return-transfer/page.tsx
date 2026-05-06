'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { warehouseApi, inventoryApi, locationApi, Warehouse } from '@/lib/api';
import { createReturnTransferRequest } from '@/lib/actions/transfer-request';
import { toast } from 'sonner';
import { ArrowLeft, Package, RotateCcw, Search, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function ReturnTransferPage() {
    const router = useRouter();
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');

    // Item Search
    const [itemQuery, setItemQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [returnQty, setReturnQty] = useState<number>(0);
    const [notes, setNotes] = useState('');
    const [outletStock, setOutletStock] = useState<number | null>(null);

    useEffect(() => {
        loadWarehouses();
        loadLocations();
    }, []);

    const loadWarehouses = async () => {
        try {
            const data = await warehouseApi.getAll();
            setWarehouses(data);
            if (data.length > 0) {
                setSelectedWarehouseId(data[0].id);
            }
        } catch (error) {
            toast.error('Failed to load warehouses');
        } finally {
            setLoading(false);
        }
    };

    const loadLocations = async () => {
        try {
            // Fetch all warehouses to get their locations
            const whs = await warehouseApi.getAll();
            const allLocs: any[] = [];
            
            for (const wh of whs) {
                try {
                    const locs = await locationApi.getByWarehouse(wh.id);
                    // Add warehouse name to each location for better UX
                    const enrichedLocs = locs.map(l => ({
                        ...l,
                        name: `${wh.name} - ${l.name}`,
                        warehouseName: wh.name
                    }));
                    allLocs.push(...enrichedLocs);
                } catch (err) {
                    console.error(`Failed to load locations for warehouse ${wh.id}`, err);
                }
            }
            
            // Filter: Usually we want to return from SHOP locations
            const filteredLocs = allLocs.sort((a, b) => a.name.localeCompare(b.name));
            
            setLocations(filteredLocs);
            if (filteredLocs.length > 0 && !selectedLocationId) {
                setSelectedLocationId(filteredLocs[0].id);
            }
        } catch (error) {
            console.error('Failed to load warehouse locations', error);
            toast.error('Failed to load outlet locations');
        }
    };

    const handleSearch = async () => {
        if (!itemQuery || !selectedLocationId) return;
        setLoading(true);
        try {
            // Search for items and get outlet-specific stock
            const res = await inventoryApi.search(itemQuery, selectedWarehouseId);
            if (res.status) {
                // Filter items that have stock in the selected outlet
                const itemsWithOutletStock = await Promise.all(
                    res.data.map(async (item: any) => {
                        const details = await inventoryApi.getDetails(item.id);
                        if (details.status) {
                            const outletStock = details.data.find((d: any) => 
                                d.location?.id === selectedLocationId
                            );
                            return {
                                ...item,
                                outletQuantity: outletStock ? Number(outletStock.quantity) : 0
                            };
                        }
                        return { ...item, outletQuantity: 0 };
                    })
                );
                
                // Only show items with outlet stock > 0
                const availableItems = itemsWithOutletStock.filter(item => item.outletQuantity > 0);
                setSearchResults(availableItems);
            } else {
                toast.error('Search failed or no items found');
            }
        } catch (error: any) {
            toast.error(error.message || 'Search failed');
        } finally {
            setLoading(false);
        }
    };

    const selectItem = (item: any) => {
        setSelectedItem(item);
        setSearchResults([]);
        setItemQuery('');
        setOutletStock(item.outletQuantity || 0);
    };

    const handleReturn = async () => {
        if (!selectedItem || !selectedWarehouseId || !selectedLocationId || returnQty <= 0) {
            toast.error('Please complete all fields');
            return;
        }

        if (returnQty > (outletStock || 0)) {
            toast.error(`Cannot return more than available stock (${outletStock})`);
            return;
        }

        setSubmitting(true);
        try {
            await createReturnTransferRequest({
                fromLocationId: selectedLocationId,
                fromWarehouseId: selectedWarehouseId,
                items: [{
                    itemId: selectedItem.id,
                    quantity: returnQty
                }],
                notes: notes
            });

            toast.success('Return request created! Awaiting outlet manager approval.');
            
            // Reset form
            setSelectedItem(null);
            setReturnQty(0);
            setNotes('');
            setOutletStock(null);
            
        } catch (error: any) {
            toast.error(error.message || 'Return request failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.inventory.return-transfer.create">
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Return Transfer Request</h1>
                    <p className="text-muted-foreground">Request items to be returned from outlet to warehouse.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Return Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Select Warehouse (Destination)</Label>
                            <Select
                                value={selectedWarehouseId}
                                onValueChange={setSelectedWarehouseId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Select Outlet (Source)</Label>
                            <Select
                                value={selectedLocationId}
                                onValueChange={setSelectedLocationId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Outlet" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(l => (
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1 p-3 bg-orange-50 rounded-md border border-orange-200">
                            <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
                                <RotateCcw className="h-4 w-4" />
                                <span>Return Flow</span>
                            </div>
                            <p className="text-xs text-orange-600">
                                Items will be returned from selected outlet back to warehouse.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Items & Return Quantity</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!selectedItem ? (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search items available in selected outlet..."
                                            className="pl-9"
                                            value={itemQuery}
                                            onChange={(e) => setItemQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    <Button onClick={handleSearch} disabled={!selectedLocationId}>
                                        Search
                                    </Button>
                                </div>

                                {!selectedLocationId && (
                                    <p className="text-sm text-muted-foreground">
                                        Please select an outlet first to search for available items.
                                    </p>
                                )}

                                {searchResults.length > 0 && (
                                    <div className="border rounded-md overflow-hidden bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Item</TableHead>
                                                    <TableHead>Available in Outlet</TableHead>
                                                    <TableHead></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {searchResults.map((item) => (
                                                    <TableRow
                                                        key={item.id}
                                                        className="cursor-pointer hover:bg-muted"
                                                        onClick={() => selectItem(item)}
                                                    >
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{item.sku}</span>
                                                                <span className="text-sm text-muted-foreground">{item.description}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary">
                                                                {item.outletQuantity} units
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="ghost">Select</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between bg-muted/30 p-4 rounded-lg border">
                                    <div className="flex gap-4">
                                        <div className="h-12 w-12 rounded bg-orange-100 flex items-center justify-center text-orange-600">
                                            <Package className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold">{selectedItem.sku}</h4>
                                            <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                                            <Badge variant="secondary" className="w-fit">
                                                Available in Outlet: {outletStock || 0}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>Clear</Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="qty">Quantity to Return</Label>
                                        <Input
                                            id="qty"
                                            type="number"
                                            min="1"
                                            max={outletStock || 0}
                                            value={returnQty}
                                            onChange={(e) => setReturnQty(Number(e.target.value))}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Max: {outletStock || 0} units
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Return Reason</Label>
                                        <Textarea
                                            id="notes"
                                            placeholder="Reason for return..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 text-lg"
                                    disabled={submitting}
                                    onClick={handleReturn}
                                >
                                    <Save className="h-5 w-5 mr-2" />
                                    {submitting ? 'Creating Return Request...' : 'Create Return Request'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            </div>
        </PermissionGuard>
    );
}