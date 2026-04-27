'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PurchaseRequisition } from '@/lib/api';
import { getPurchaseRequisitions } from '@/lib/actions/purchase-requisition';
import { createRfq } from '@/lib/actions/rfq';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/auth/permission-guard';

interface FormValues {
    purchaseRequisitionId: string;
    notes: string;
}

export default function CreateRfq() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [approvedPRs, setApprovedPRs] = useState<PurchaseRequisition[]>([]);
    const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);

    const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>();

    useEffect(() => {
        fetchApprovedPRs();
    }, []);

    const fetchApprovedPRs = async () => {
        try {
            const data = await getPurchaseRequisitions('APPROVED');
            setApprovedPRs(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handlePRSelect = async (prId: string) => {
        setValue('purchaseRequisitionId', prId);
        const pr = approvedPRs.find(p => p.id === prId);
        setSelectedPR(pr || null);
    };

    const onSubmit = async (data: FormValues) => {
        try {
            setLoading(true);
            const result = await createRfq(data);
            if (result.status !== false && result.id) {
                toast.success('RFQ created successfully');
                router.push(`/erp/procurement/rfq/${result.id}`);
            } else {
                toast.error(result.message || 'Failed to create RFQ');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.rfq.create">
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Create RFQ</h1>
                <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Purchase Requisition</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="purchaseRequisitionId">Approved PR</Label>
                            <Select onValueChange={handlePRSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an approved PR" />
                                </SelectTrigger>
                                <SelectContent>
                                    {approvedPRs.map((pr) => (
                                        <SelectItem key={pr.id} value={pr.id}>
                                            {pr.prNumber} - {pr.requestedBy} ({pr.items?.length || 0} items)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.purchaseRequisitionId && <span className="text-red-500 text-sm">Required</span>}
                        </div>

                        {selectedPR && (
                            <div className="border rounded-lg p-4 bg-muted/50">
                                <h3 className="font-semibold mb-2">PR Details</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><strong>PR Number:</strong> {selectedPR.prNumber}</div>
                                    <div><strong>Requested By:</strong> {selectedPR.requestedBy}</div>
                                    <div><strong>Department:</strong> {selectedPR.department || '-'}</div>
                                    <div><strong>Items:</strong> {selectedPR.items?.length || 0}</div>
                                </div>
                                <div className="mt-3">
                                    <strong>Items:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {selectedPR.items?.map((item) => (
                                            <li key={item.id}>
                                                {(item as any).item
                                                  ? `${(item as any).item.itemId} - ${(item as any).item.description} - Qty: ${item.requiredQty}`
                                                  : 'Item missing'
                                                }
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" {...register('notes')} placeholder="Optional notes for vendors" />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={loading || !selectedPR}>
                        {loading ? 'Creating...' : 'Create RFQ Draft'}
                    </Button>
                </div>
            </form>
        </div>
        </PermissionGuard>
    );
}
