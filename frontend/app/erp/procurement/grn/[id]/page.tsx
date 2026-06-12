'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Grn } from '@/lib/api';
import { getGrn, updateGrnStatus } from '@/lib/actions/grn';
import { ArrowLeft, Printer, Building2, CheckCircle2, Clock, XCircle, ThumbsUp, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { toast } from 'sonner';

export default function GrnDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [grn, setGrn] = useState<Grn | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { hasPermission } = useAuth();

  const canCheck = hasPermission('erp.procurement.grn.check');
  const canAuthorize = hasPermission('erp.procurement.grn.authorize');

  const fetchGrn = async () => {
    try {
      setLoading(true);
      const data = await getGrn(id);
      setGrn(data);
    } catch (error) {
      console.error('Failed to load GRN:', error);
      toast.error('Failed to load GRN details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchGrn();
    }
  }, [id]);

  const handleAction = async (newStatus: string) => {
    try {
      setSubmitting(true);
      const actionText = newStatus === 'REJECTED' ? 'reject' : 'approve';
      await updateGrnStatus(id, newStatus);
      toast.success(`Goods Receipt Note ${actionText}ed successfully!`);
      fetchGrn(); // Reload data
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || `Failed to update status`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading GRN...</div>;
  if (!grn) return <div className="p-6 text-center text-red-500">GRN not found</div>;

  return (
    <PermissionGuard permissions="erp.procurement.grn.read">
    <>
      <style jsx global>{`
        @media print {
            body {
                visibility: hidden;
            }
            #print-section {
                visibility: visible;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: auto;
                margin: 0;
                padding: 0;
                background: white;
                z-index: 9999;
            }
            #print-section * {
                visibility: visible;
            }
            @page {
                margin: 0;
                size: auto;
            }
            header, nav, footer, aside, .banner {
                display: none !important;
            }
        }
      `}</style>

      {/* Dashboard View */}
      <div className="p-6 space-y-6 max-w-5xl mx-auto print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/erp/procurement/grn" transitionTypes={["nav-back"]}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{grn.grnNumber}</h1>
            <p className="text-muted-foreground">
              PO: {grn.purchaseOrder?.poNumber || 'N/A'} • {new Date(grn.receivedDate).toLocaleDateString()}
            </p>
          </div>
          <div className="ml-auto flex gap-2 items-center">
            {getStatusBadge(grn.status)}
            <Button onClick={() => window.print()} variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Print GRN
            </Button>
          </div>
        </div>

        {/* Visual Approval Stepper */}
        <Card className="bg-gradient-to-r from-slate-900/90 to-slate-950/95 text-white border-slate-800 shadow-xl overflow-hidden relative backdrop-blur-md">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
            <CardHeader className="relative pb-2">
                <CardTitle className="text-lg font-medium text-slate-300">GRN Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent className="relative py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                    {/* Connector Line */}
                    <div className="hidden md:block absolute left-[16.6%] right-[16.6%] top-[24px] h-0.5 bg-slate-800 z-0" />
                    
                    {/* Step 1: Prepared */}
                    <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 md:mx-auto">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col md:items-center">
                            <span className="font-semibold text-slate-100 text-sm">1. Prepared (Maker)</span>
                            <span className="text-xs text-slate-400 mt-0.5">{grn.creatorName || 'Prepared'}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">{new Date(grn.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Step 2: Checked */}
                    <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all duration-300 ${
                            grn.status === 'PENDING_CHECKER'
                                ? 'bg-amber-500 border-amber-400 text-white animate-pulse shadow-lg shadow-amber-500/20'
                                : grn.status === 'REJECTED' && !grn.checkedById
                                ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                                : grn.checkedById
                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                        }`}>
                            {grn.checkedById ? (
                                <CheckCircle2 className="h-6 w-6" />
                            ) : grn.status === 'PENDING_CHECKER' ? (
                                <Clock className="h-6 w-6" />
                            ) : grn.status === 'REJECTED' && !grn.checkedById ? (
                                <XCircle className="h-6 w-6" />
                            ) : (
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                            )}
                        </div>
                        <div className="flex flex-col md:items-center">
                            <span className="font-semibold text-slate-100 text-sm">2. Checked (Checker)</span>
                            {grn.checkedById ? (
                                <>
                                    <span className="text-xs text-slate-400 mt-0.5">{grn.checkerName}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{grn.checkedAt ? new Date(grn.checkedAt).toLocaleDateString() : ''}</span>
                                </>
                            ) : grn.status === 'PENDING_CHECKER' ? (
                                <span className="text-xs text-amber-400 font-medium animate-pulse mt-0.5">Awaiting Verification</span>
                            ) : (
                                <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Authorized */}
                    <div className="flex items-start md:flex-col gap-4 md:text-center w-full md:w-1/3 z-10">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 md:mx-auto transition-all duration-300 ${
                            grn.status === 'VALUED' || grn.status === 'RECEIVED_UNVALUED'
                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                : grn.status === 'PENDING_AUTHORIZER'
                                ? 'bg-blue-500 border-blue-400 text-white animate-pulse shadow-lg shadow-blue-500/20'
                                : grn.status === 'REJECTED' && grn.checkedById
                                ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                        }`}>
                            {grn.status === 'VALUED' || grn.status === 'RECEIVED_UNVALUED' ? (
                                <CheckCircle2 className="h-6 w-6" />
                            ) : grn.status === 'PENDING_AUTHORIZER' ? (
                                <Clock className="h-6 w-6" />
                            ) : grn.status === 'REJECTED' && grn.checkedById ? (
                                <XCircle className="h-6 w-6" />
                            ) : (
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                            )}
                        </div>
                        <div className="flex flex-col md:items-center">
                            <span className="font-semibold text-slate-100 text-sm">3. Approved (Authorizer)</span>
                            {grn.authorizedById ? (
                                <>
                                    <span className="text-xs text-slate-400 mt-0.5">{grn.authorizerName}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{grn.authorizedAt ? new Date(grn.authorizedAt).toLocaleDateString() : ''}</span>
                                </>
                            ) : grn.status === 'PENDING_AUTHORIZER' ? (
                                <span className="text-xs text-blue-400 font-medium animate-pulse mt-0.5">Awaiting Authorization</span>
                            ) : grn.status === 'REJECTED' && grn.checkedById ? (
                                <span className="text-xs text-rose-400 font-medium mt-0.5">Rejected</span>
                            ) : (
                                <span className="text-xs text-slate-500 mt-0.5">Pending</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Approval Actions Panel */}
        {((grn.status === 'PENDING_CHECKER' && canCheck) || 
          (grn.status === 'PENDING_AUTHORIZER' && canAuthorize)) && (
            <Card className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/40 dark:to-slate-900/20 border-blue-200/60 dark:border-slate-800 shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="text-blue-900 dark:text-blue-400 flex items-center gap-2 text-lg">
                        <ThumbsUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Pending GRN Approval Action Required
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-blue-700 dark:text-slate-300">
                        This Goods Receipt Note is currently in <strong>{grn.status === 'PENDING_CHECKER' ? 'Pending Checker Verification' : 'Pending Authorizer Release'}</strong>. 
                        As an authorized user, you can either approve/verify this receipt to forward it to the next step, or reject it.
                    </p>
                    <div className="flex gap-4">
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                            onClick={() => handleAction(grn.status === 'PENDING_CHECKER' ? 'PENDING_AUTHORIZER' : 'APPROVED')}
                            disabled={submitting}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            {grn.status === 'PENDING_CHECKER' ? 'Verify & Forward' : 'Authorize & Release GRN'}
                        </Button>
                        <Button 
                            variant="destructive"
                            className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                            onClick={() => handleAction('REJECTED')}
                            disabled={submitting}
                        >
                            <X className="mr-2 h-4 w-4" />
                            Reject Goods Receipt Note
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

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
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grn.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">No items</TableCell>
                  </TableRow>
                ) : (
                  grn.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-sm">{it.item?.itemId || it.itemId}</TableCell>
                      <TableCell>{it.item?.size?.name || '-'}</TableCell>
                      <TableCell>{it.item?.color?.name || '-'}</TableCell>
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

      {/* Print View */}
      <div id="print-section" className="hidden print:block min-h-screen bg-white p-0">
          <div className="w-full max-w-[1000px] mx-auto bg-white text-black p-8 font-sans print:p-8 print:max-w-none box-border">
              {/* Header */}
              <div className="flex justify-between mb-6 gap-4 items-start">
                  {/* Logo */}
                  <div className="w-[20%] flex flex-col items-start justify-center">
                     <img src="/image.png" alt="Logo" className="w-32 object-contain" />
                  </div>
                  
                  {/* Title */}
                  <div className="w-[35%] flex flex-col justify-center">
                    <div className="bg-[#eef2f6] text-black w-full text-center py-2 text-xl sm:text-xl font-bold  print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact]">
                      Goods Receipt Note
                    </div>
                  </div>

                  {/* Details Box */}
                  <div className="w-[45%] bg-[#f8fafc] text-xs sm:text-[13px] p-2 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
                     <div className="flex justify-between mb-2">
                       <span className="font-bold">GRN Number:</span>
                       <span className="font-bold">{grn.grnNumber}</span>
                     </div>
                     <div className="flex justify-between mb-2">
                       <span className="font-bold">PO Number:</span>
                       <span>{grn.purchaseOrder?.poNumber || 'N/A'}</span>
                     </div>
                     <div className="flex justify-between">
                       <div className="flex gap-2">
                         <span className="font-bold">Date:</span>
                         <span>{new Date(grn.receivedDate).toLocaleDateString('en-GB')}</span>
                       </div>
                     </div>
                  </div>
              </div>

              {/* Warehouse / Ship To Box */}
              <div className="flex gap-4 mb-4 text-xs sm:text-[13px]">
                  <div className="w-1/2 p-2 border border-gray-300 flex flex-col justify-center">
                      <div className="font-bold border-b border-gray-300 mb-2 pb-1">Warehouse</div>
                      <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>{grn.warehouse?.name || 'N/A'}</span></div>
                      <div className="flex gap-2"><span className="font-bold w-16 shrink-0">Location:</span> <span>Speed Limit ERP Location</span></div>
                  </div>
                  <div className="w-1/2 p-2 border border-gray-300 flex flex-col justify-center">
                      <div className="font-bold border-b border-gray-300 mb-2 pb-1">Ship To</div>
                      <div className="flex gap-2 mb-1"><span className="font-bold w-16 shrink-0">Name:</span> <span>Speed Limit Warehouse</span></div>
                      <div className="flex gap-2"><span className="font-bold w-16 shrink-0">Address:</span> <span>Main Warehouse, Plot #45, Industrial Area, Karachi, Pakistan</span></div>
                  </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs sm:text-[13px] mb-4 border-collapse table-fixed">
                  <thead>
                    <tr className="border-y-2 border-black">
                      <th className="py-2 pr-2 text-left font-bold w-[40%]">Item Details</th>
                      <th className="py-2 pr-2 text-left font-bold w-[15%]">Size</th>
                      <th className="py-2 pr-2 text-left font-bold w-[15%]">Color</th>
                      <th className="py-2 pr-2 text-right font-bold w-[30%]">Received Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grn.items && grn.items.length > 0 ? (
                      grn.items.map((item, i) => (
                        <tr key={item.id || i} className="border-b border-gray-300 align-top">
                          <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                            <div className="font-medium">{item.item?.itemId || item.itemId}</div>
                            <div className="text-gray-700">{item.description || '-'}</div>
                          </td>
                          <td className="py-2 pr-2 text-left overflow-hidden text-ellipsis">
                            {item.item?.size?.name || '-'}
                          </td>
                          <td className="py-2 pr-2 text-left overflow-hidden text-ellipsis">
                            {item.item?.color?.name || '-'}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums font-bold">
                            {parseFloat(item.receivedQty as any).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground border-b border-gray-300">
                              No items found for this GRN
                          </td>
                      </tr>
                    )}
                  </tbody>
              </table>

              {/* Remarks */}
              <div className="mt-4 mb-8">
                  <div className="font-bold text-xs sm:text-[14px]">Notes & Instructions</div>
                  <p className="text-xs sm:text-[13px] mt-1 text-gray-700 whitespace-pre-wrap">{grn.notes || "N/A"}</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-3">
                  <div className="border border-black h-24 p-2 flex flex-col justify-between items-center bg-white text-black">
                      <span className="text-[10px] sm:text-[11px] font-bold text-center border-b border-black w-full pb-1">PREPARED BY (MAKER)</span>
                      {grn.creatorName && (
                          <div className="text-center">
                              <p className="text-[11px] font-semibold">{grn.creatorName}</p>
                              <p className="text-[9px] text-gray-600">{new Date(grn.createdAt).toLocaleDateString('en-GB')}</p>
                          </div>
                      )}
                  </div>
                  <div className="border border-black h-24 p-2 flex flex-col justify-between items-center bg-white text-black">
                      <span className="text-[10px] sm:text-[11px] font-bold text-center border-b border-black w-full pb-1">CHECKED BY (CHECKER)</span>
                      {grn.checkerName ? (
                          <div className="text-center">
                              <p className="text-[11px] font-semibold">{grn.checkerName}</p>
                              <p className="text-[9px] text-gray-600">{grn.checkedAt ? new Date(grn.checkedAt).toLocaleDateString('en-GB') : ''}</p>
                          </div>
                      ) : (
                          <span className="text-[10px] text-gray-400 italic">Pending Verification</span>
                      )}
                  </div>
                  <div className="border border-black h-24 p-2 flex flex-col justify-between items-center bg-white text-black">
                      <span className="text-[10px] sm:text-[11px] font-bold text-center border-b border-black w-full pb-1">APPROVED BY (AUTHORIZER)</span>
                      {grn.authorizerName ? (
                          <div className="text-center">
                              <p className="text-[11px] font-semibold">{grn.authorizerName}</p>
                              <p className="text-[9px] text-gray-600">{grn.authorizedAt ? new Date(grn.authorizedAt).toLocaleDateString('en-GB') : ''}</p>
                          </div>
                      ) : (
                          <span className="text-[10px] text-gray-400 italic">Pending Approval</span>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </>
    </PermissionGuard>
  );
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'PENDING_CHECKER':
            return (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900 text-[13px] px-2.5 py-0.5">
                    Pending Checker
                </Badge>
            );
        case 'PENDING_AUTHORIZER':
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900 text-[13px] px-2.5 py-0.5">
                    Pending Authorizer
                </Badge>
            );
        case 'VALUED':
            return (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900 text-[13px] px-2.5 py-0.5">
                    Valued
                </Badge>
            );
        case 'RECEIVED_UNVALUED':
            return (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900 text-[13px] px-2.5 py-0.5">
                    Received Unvalued
                </Badge>
            );
        case 'REJECTED':
            return (
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-medium dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900 text-[13px] px-2.5 py-0.5">
                    Rejected
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-900 text-[13px] px-2.5 py-0.5">
                    {status}
                </Badge>
            );
    }
};