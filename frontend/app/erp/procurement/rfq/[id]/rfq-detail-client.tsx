'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RequestForQuotation } from '@/lib/api';
import { addVendorsToRfq, markRfqAsSent } from '@/lib/actions/rfq';
import { toast } from 'sonner';

interface Supplier {
    id: string;
    code: string;
    name: string;
    email?: string;
    contactNo?: string;
    type?: 'LOCAL' | 'INTERNATIONAL';
}

interface RfqDetailClientProps {
    rfq: RequestForQuotation;
    suppliers: Supplier[];
    canAddVendors: boolean;
    canSend: boolean;
}

export function RfqDetailClient({ rfq, suppliers, canAddVendors, canSend }: RfqDetailClientProps) {
    const [loading, setLoading] = useState(false);
    const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'local' | 'import'>('all');

    const existingVendorIds = rfq.vendors.map(v => v.vendorId);
    const availableSuppliers = suppliers.filter(s => !existingVendorIds.includes(s.id));
    const filteredSuppliers = availableSuppliers.filter((s) => {
        const matchesSearch =
            !search ||
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.code.toLowerCase().includes(search.toLowerCase());
        const matchesType =
            typeFilter === 'all' ||
            (typeFilter === 'local' && (s.type === 'LOCAL' || (s as any).type === 'local')) ||
            (typeFilter === 'import' && (s.type === 'INTERNATIONAL' || (s as any).type === 'import'));
        return matchesSearch && matchesType;
    });

    const handleAddVendors = async () => {
        try {
            setLoading(true);
            const result = await addVendorsToRfq(rfq.id, selectedVendors);
            if (result.status !== false) {
                toast.success('Vendors added successfully');
                setSelectedVendors([]);
                setDialogOpen(false);
            } else {
                toast.error(result.message || 'Failed to add vendors');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsSent = async () => {
        try {
            setLoading(true);
            const result = await markRfqAsSent(rfq.id);
            if (result.status !== false) {
                toast.success('RFQ marked as sent');
            } else {
                toast.error(result.message || 'Failed to mark as sent');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (rfq.status !== 'DRAFT') return null;

    return (
        <div className="flex gap-2">
            {canAddVendors && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary">Add Vendors</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Select Vendors</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-3 mb-3">
                        <Input
                            placeholder="Search vendor by name or code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1"
                        />
                        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="local">Local</SelectItem>
                                <SelectItem value="import">Import</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredSuppliers.length === 0 ? (
                            <p className="text-muted-foreground">All suppliers have been added.</p>
                        ) : (
                            filteredSuppliers.map((supplier) => (
                                <div key={supplier.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                                    <Checkbox
                                        id={supplier.id}
                                        checked={selectedVendors.includes(supplier.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedVendors([...selectedVendors, supplier.id]);
                                            } else {
                                                setSelectedVendors(selectedVendors.filter(id => id !== supplier.id));
                                            }
                                        }}
                                    />
                                    <label htmlFor={supplier.id} className="flex-1 cursor-pointer">
                                        <div className="font-medium">{supplier.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {supplier.code} | {supplier.email || 'No email'} | {supplier.contactNo || 'No contact'}
                                        </div>
                                    </label>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddVendors} disabled={loading || selectedVendors.length === 0}>
                            {loading ? 'Adding...' : `Add ${selectedVendors.length} Vendor(s)`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            )}
            {canSend && (
                <Button onClick={handleMarkAsSent} disabled={loading || rfq.vendors.length === 0}>
                    {loading ? 'Sending...' : 'Mark as Sent'}
                </Button>
            )}
        </div>
    );
}
