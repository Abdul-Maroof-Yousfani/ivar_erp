'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText } from 'lucide-react';
import Link from 'next/link';
import { debitNoteApi, DebitNote } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PermissionGuard } from "@/components/auth/permission-guard";

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  APPROVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function DebitNotesPage() {
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDebitNotes();
  }, []);

  const loadDebitNotes = async () => {
    try {
      setLoading(true);
      const data = await debitNoteApi.getAll();
      setDebitNotes(data);
    } catch (error) {
      console.error('Error loading debit notes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading debit notes...</div>;
  }

  return (
    <PermissionGuard permissions="erp.procurement.dn.read">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Debit Notes</h1>
            <p className="text-gray-600">Supplier financial adjustments and returns</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Debit Notes ({debitNotes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {debitNotes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No debit notes found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Debit Note #</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Source Return</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debitNotes.map((note) => (
                      <tr key={note.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{note.debitNoteNo}</td>
                        <td className="p-3">{note.supplier?.name || 'N/A'}</td>
                        <td className="p-3 font-semibold text-red-600">{formatCurrency(note.amount)}</td>
                        <td className="p-3">
                          <Badge className={(statusColors as any)[note.status]}>
                            {note.status}
                          </Badge>
                        </td>
                        <td className="p-3">{formatDate(note.date)}</td>
                        <td className="p-3 underline text-blue-600">
                          {note.purchaseReturn?.returnNumber ? (
                            <Link href={`/erp/procurement/purchase-returns/${note.purchaseReturnId}`}>
                              {note.purchaseReturn.returnNumber}
                            </Link>
                          ) : 'N/A'}
                        </td>
                        <td className="p-3">
                          <Link href={`/erp/procurement/debit-notes/${note.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-1" /> View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
