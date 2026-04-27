'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Grn } from '@/lib/api';
import { getGrn } from '@/lib/actions/grn';
import { ArrowLeft } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function GrnDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [grn, setGrn] = useState<Grn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getGrn(id);
        setGrn(data);
      } catch (error) {
        console.error('Failed to load GRN:', error);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  if (loading) return <div className="p-0">Loading...</div>;
  if (!grn) return <div className="p-0">Not found</div>;

  return (
    <PermissionGuard permissions="erp.procurement.grn.read">
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{grn.grnNumber}</h1>
          <p className="text-muted-foreground">
            PO: {grn.purchaseOrder?.poNumber || 'N/A'} • {new Date(grn.receivedDate).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={grn.status === 'SUBMITTED' ? 'default' : 'secondary'} className="text-lg px-3 py-1">
            {grn.status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">GRN Number</div>
            <div className="font-medium">{grn.grnNumber}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">PO Number</div>
            <div className="font-medium">{grn.purchaseOrder?.poNumber || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Warehouse</div>
            <div className="font-medium">{grn.warehouse?.name || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Received Date</div>
            <div className="font-medium">{new Date(grn.receivedDate).toLocaleDateString()}</div>
          </div>
          <div className="md:col-span-4">
            <div className="text-sm text-muted-foreground">Notes</div>
            <div className="font-medium">{grn.notes || '-'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Received Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">No items</TableCell>
                </TableRow>
              ) : (
                grn.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-sm">{it.item?.itemId || it.itemId}</TableCell>
                    <TableCell>{it.description || '-'}</TableCell>
                    <TableCell className="text-right">{it.receivedQty}</TableCell>
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
