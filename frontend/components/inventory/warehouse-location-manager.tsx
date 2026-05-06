'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { locationApi, WarehouseLocation } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Store, Package, CheckCircle2, XCircle } from 'lucide-react';

interface WarehouseLocationManagerProps {
    warehouseId: string;
}

export function WarehouseLocationManager({ warehouseId }: WarehouseLocationManagerProps) {
    const [locations, setLocations] = useState<WarehouseLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);

    const [newLocation, setNewLocation] = useState({
        code: '',
        name: '',
        type: 'SHOP'
    });

    useEffect(() => {
        loadLocations();
    }, [warehouseId]);

    const loadLocations = async () => {
        try {
            const data = await locationApi.getByWarehouse(warehouseId);
            setLocations(data);
        } catch (error) {
            console.error('Failed to load locations:', error);
            toast.error('Failed to load locations');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newLocation.code || !newLocation.name) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            await locationApi.create({
                ...newLocation,
                warehouseId,
                isActive: true
            });
            toast.success('Location added successfully');
            setNewLocation({ code: '', name: '', type: 'SHOP' });
            setAdding(false);
            loadLocations();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add location');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await locationApi.updateStatus(id, !currentStatus);
            toast.success('Status updated');
            loadLocations();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Store Locations & Storage Areas</h3>
                {!adding && (
                    <Button onClick={() => setAdding(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Location
                    </Button>
                )}
            </div>

            {adding && (
                <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Code</label>
                            <Input
                                placeholder="e.g. GUL-01"
                                value={newLocation.code}
                                onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                placeholder="e.g. Gulshan Shop Area"
                                value={newLocation.name}
                                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <Select
                                value={newLocation.type}
                                onValueChange={(val) => setNewLocation({ ...newLocation, type: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MAIN">Main Storage</SelectItem>
                                    <SelectItem value="SHOP">Physical Shop / Store</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleAdd}>Save Location</Button>
                    </div>
                </div>
            )}

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Location Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">Loading locations...</TableCell>
                            </TableRow>
                        ) : locations.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                    No locations defined. Add a MAIN or SHOP location.
                                </TableCell>
                            </TableRow>
                        ) : (
                            locations.map((loc) => (
                                <TableRow key={loc.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {loc.type === 'MAIN' ? (
                                                <Package className="h-4 w-4 text-blue-500" />
                                            ) : (
                                                <Store className="h-4 w-4 text-green-500" />
                                            )}
                                            <span className="text-xs font-semibold uppercase">{loc.type}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono">{loc.code}</TableCell>
                                    <TableCell>{loc.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={loc.isActive ? 'default' : 'secondary'}>
                                            {loc.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleStatus(loc.id, loc.isActive)}
                                        >
                                            {loc.isActive ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
