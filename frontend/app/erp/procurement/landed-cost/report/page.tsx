'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLandedCosts } from '@/lib/actions/landed-cost';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function LandedCostListPage() {
    const router = useRouter();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await getLandedCosts();
            setData(Array.isArray(res) ? res : res?.data || []);
        } catch (err) {
            console.error('Failed to fetch landed costs:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(item =>
        item.landedCostNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.grn?.grnNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <PermissionGuard permissions="erp.procurement.landed-cost.read">
        <div className="p-4 space-y-4 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Landed Cost Reports</h1>
                <Button onClick={() => router.push('/erp/procurement/landed-cost/setup')}>
                    <Plus className="mr-2 h-4 w-4" /> New Landed Cost
                </Button>
            </div>

            <Card className="shadow-sm border-gray-200">
                <CardHeader className="pb-3">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search by LC#, GRN, or Supplier..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="font-bold text-gray-700">LC Number</TableHead>
                                <TableHead className="font-bold text-gray-700">Date</TableHead>
                                <TableHead className="font-bold text-gray-700">GRN Reference</TableHead>
                                <TableHead className="font-bold text-gray-700">Supplier</TableHead>
                                <TableHead className="font-bold text-gray-700 text-right">Total Quantity</TableHead>
                                <TableHead className="font-bold text-gray-700 text-right">Total Cost (PKR)</TableHead>
                                <TableHead className="font-bold text-gray-700 text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                                        No Landed Cost records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <TableCell className="font-semibold text-blue-700">{item.landedCostNumber}</TableCell>
                                        <TableCell>{format(new Date(item.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{item.grn?.grnNumber}</TableCell>
                                        <TableCell>{item.supplier?.name}</TableCell>
                                        <TableCell className="text-right">{Number(item.totalQuantity).toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-bold">{Number(item.totalLandedCost).toLocaleString()}</TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                onClick={() => router.push(`/erp/procurement/landed-cost/report/${item.id}`)}
                                            >
                                                <FileText className="h-4 w-4 mr-1" /> View Report
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        </PermissionGuard>
    );
}
