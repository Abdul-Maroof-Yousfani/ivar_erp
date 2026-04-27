'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft } from 'lucide-react';
import { debitNoteApi, DebitNote } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function DebitNoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [note, setNote] = useState<DebitNote | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    if (id) loadNote();
  }, [id]);

  const loadNote = async () => {
    try {
      setLoading(true);
      const data = await debitNoteApi.getById(id as string);
      setNote(data);
    } catch (error) {
      console.error('Error loading debit note:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading debit note...</div>;
  if (!note) return <div className="p-6 text-center">Debit note not found</div>;

  return (
    <PermissionGuard permissions="erp.procurement.dn.read">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center no-print">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Debit Note
          </Button>
        </div>

        <div ref={printRef} className="bg-white p-8 border rounded-lg shadow-sm print:shadow-none print:border-none">
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-red-600">DEBIT NOTE</h1>
              <p className="text-gray-500 mt-1">Ref No: {note.debitNoteNo}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">Speed Limit</h2>
              <p className="text-gray-600 text-sm">Industrial Area, Karachi</p>
              <p className="text-gray-600 text-sm">NTN: 1234567-8</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Debit To:</h3>
              <div className="space-y-1">
                <p className="font-bold text-lg">{note.supplier?.name}</p>
                <p className="text-gray-600">{note.supplier?.code}</p>
                <p className="text-gray-600">{note.supplier?.address || 'Pakistan'}</p>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Details:</h3>
              <div className="space-y-1">
                <p><span className="text-gray-500">Date:</span> {formatDate(note.date)}</p>
                <p><span className="text-gray-500">Status:</span> {note.status}</p>
                {note.purchaseInvoice && (
                  <p><span className="text-gray-500">Against Invoice:</span> {note.purchaseInvoice.invoiceNumber}</p>
                )}
                {note.purchaseReturn && (
                  <p><span className="text-gray-500">Against Return:</span> {note.purchaseReturn.returnNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-6 rounded-lg border mb-8">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-700">Total Adjustment Amount:</span>
              <span className="text-2xl font-bold text-red-600">{formatCurrency(note.amount)}</span>
            </div>
            <p className="text-sm text-gray-500 mt-2 italic">
              Note: This amount has been debited to your account against the goods returned.
            </p>
          </div>

          {/* Breakdown - Mocking if items are not directly in DN but PR */}
          {note.purchaseReturn?.items && (
              <div className="mt-8">
                  <h3 className="text-lg font-bold mb-4">Return Items Details</h3>
                  <table className="w-full text-sm">
                      <thead>
                          <tr className="border-b bg-gray-50">
                              <th className="text-left p-2">Item</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Unit Price</th>
                              <th className="text-right p-2">Total</th>
                          </tr>
                      </thead>
                      <tbody>
                          {note.purchaseReturn.items.map((item: any) => (
                              <tr key={item.id} className="border-b">
                                  <td className="p-2">{item.description || 'Item'}</td>
                                  <td className="p-2 text-right">{item.returnQty}</td>
                                  <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                  <td className="p-2 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}

          <div className="mt-16 flex justify-between border-t pt-8">
            <div className="text-center w-40">
              <div className="border-t border-dashed pt-2 text-xs text-gray-500">Prepared By</div>
            </div>
            <div className="text-center w-40">
              <div className="border-t border-dashed pt-2 text-xs text-gray-500">Authorized Signature</div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @media print {
            .no-print {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </PermissionGuard>
  );
}
