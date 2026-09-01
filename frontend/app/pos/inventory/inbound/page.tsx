"use client";

import React, { useState, useEffect } from "react";
import {
    ArrowDown,
    ArrowLeft,
    RefreshCcw,
    Package,
    CheckCircle2,
    FileText,
    Clock,
    Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { getInboundTransferRequests, acceptTransferRequest } from "@/lib/actions/transfer-request";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function InboundRequestsPage() {
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    const handlePrint = (request: any) => {
        setPrintingId(request.id);
        const win = window.open("", "_blank");
        if (!win) {
            toast.error("Allow popups to print");
            setPrintingId(null);
            return;
        }

        const dateStr = format(new Date(request.createdAt), "dd MMM yyyy HH:mm");
        const companyName = "Speed Limit";
        const sourceLoc = request.fromLocation?.name || "Source Outlet";
        const destLoc = user?.terminal?.location?.name || "This Location";
        const refNo = request.requestNo || "N/A";
        const notes = request.notes || "";

        // Status styling and text
        let statusText = "PENDING SOURCE APPROVAL";
        let statusClass = "status-pending";
        if (request.status === "SOURCE_APPROVED") {
            statusText = "SOURCE APPROVED / AWAITING RECEIPT";
            statusClass = "status-approved";
        } else if (request.status === "COMPLETED") {
            statusText = "COMPLETED / RECEIVED";
            statusClass = "status-completed";
        } else if (request.status === "REJECTED") {
            statusText = "REJECTED";
            statusClass = "status-rejected";
        }

        win.document.write(`
            <html><head><title>Transfer Report - ${refNo}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.4; padding: 40px; }
                .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; }
                .company-name { font-size: 24px; font-weight: 800; color: #1e3a8a; letter-spacing: 1px; }
                .document-title { font-size: 14px; font-weight: 600; color: #4b5563; text-transform: uppercase; margin-top: 4px; }
                .status-badge { padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; border: 1px solid; display: inline-block; }
                .status-pending { background-color: #fef3c7; color: #d97706; border-color: #f59e0b; }
                .status-approved { background-color: #dbeafe; color: #2563eb; border-color: #3b82f6; }
                .status-completed { background-color: #dcfce7; color: #15803d; border-color: #22c55e; }
                .status-rejected { background-color: #fee2e2; color: #b91c1c; border-color: #ef4444; }
                
                .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 30px; background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .meta-item { display: flex; flex-direction: column; }
                .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
                .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: left; }
                td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; }
                .text-right { text-align: right; }
                .font-bold { font-weight: 700; }
                
                .notes-section { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 40px; border-radius: 0 8px 8px 0; }
                .notes-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
                .notes-content { font-size: 12px; color: #334155; }
                
                .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 60px; }
                .signature-box { border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
                
                @media print {
                    body { padding: 0; }
                    .meta-grid { background-color: #fff !important; border: 1px solid #cbd5e1; }
                    th { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style></head><body>
                <div class="header-container">
                    <div>
                        <div class="company-name">${companyName}</div>
                        <div class="document-title">INBOUND STOCK TRANSFER REPORT</div>
                    </div>
                    <div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
                
                <div class="meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">Reference No</span>
                        <span class="meta-value">${refNo}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Request Date</span>
                        <span class="meta-value">${dateStr}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Source Outlet</span>
                        <span class="meta-value">${sourceLoc}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Destination Outlet</span>
                        <span class="meta-value">${destLoc}</span>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">S.No</th>
                            <th>SKU Code</th>
                            <th>Item Description</th>
                            <th>Size</th>
                            <th>Color</th>
                            <th class="text-right" style="width: 100px;">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${request.items.map((item: any, idx: number) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td class="font-bold">${item.item?.sku || "—"}</td>
                                <td>${item.item?.description || "Item"}</td>
                                <td>${item.item?.size?.name || item.item?.size || "—"}</td>
                                <td>${item.item?.color?.name || item.item?.color || "—"}</td>
                                <td class="text-right font-bold">${Number(item.quantity)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                ${notes ? `
                    <div class="notes-section">
                        <div class="notes-title">Transfer Reason / Notes</div>
                        <div class="notes-content">${notes}</div>
                    </div>
                ` : ''}
                
                <div class="signature-grid">
                    <div class="signature-box">Prepared By</div>
                    <div class="signature-box">Source Authorized By</div>
                    <div class="signature-box">Received By</div>
                </div>
            </body></html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
        setPrintingId(null);
    };

    const locationId = user?.terminal?.location?.id || user?.locationId;

    const fetchRequests = async () => {
        if (!locationId) return;
        setIsLoading(true);
        try {
            const res = await getInboundTransferRequests(locationId, activeTab);
            if (res.status) {
                setRequests(res.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch inbound requests", error);
            toast.error("Failed to load inbound requests");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [locationId, activeTab]);

    const handleAccept = async (requestId: string) => {
        setIsAccepting(requestId);
        try {
            const res = await acceptTransferRequest(requestId, user?.id);
            if (res.status) {
                toast.success("Transfer completed! Items received successfully.");
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                toast.error(res.message || "Failed to accept transfer");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to accept transfer");
        } finally {
            setIsAccepting(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <header className="flex-none p-4 md:p-6 border-b bg-muted/20 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-4 max-w-5xl mx-auto w-full">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight">Inbound Transfers</h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                            Accept incoming transfers to
                            <Badge variant="outline" className="ml-1 font-bold text-green-600">
                                {user?.terminal?.location?.name || "This Location"}
                            </Badge>
                            from other outlets
                        </p>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchRequests} disabled={isLoading}>
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 pb-20 overflow-auto">
                <div className="max-w-5xl mx-auto w-full space-y-6">
                    {/* Custom Modern Tabs */}
                    <div className="flex gap-2 p-1 bg-muted rounded-xl max-w-xs border shadow-sm">
                        <button
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'pending'
                                    ? 'bg-white text-green-600 shadow-sm border border-black/5'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Pending Actions
                        </button>
                        <button
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'history'
                                    ? 'bg-white text-green-600 shadow-sm border border-black/5'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setActiveTab('history')}
                        >
                            Transfer History
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : requests.length === 0 ? (
                        <Card className="border-dashed h-[400px] flex flex-col items-center justify-center text-center p-8 bg-muted/5">
                            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <ArrowDown className="h-10 w-10 text-green-600/60" />
                            </div>
                            <h2 className="text-xl mb-2 text-muted-foreground font-bold">
                                {activeTab === 'pending' ? "No Inbound Transfers" : "No Inbound History"}
                            </h2>
                            <p className="max-w-xs mx-auto text-muted-foreground">
                                {activeTab === 'pending' 
                                    ? "No pending inbound transfers for this location." 
                                    : "No completed or rejected inbound transfers found."}
                            </p>
                            <Button variant="outline" className="mt-6" onClick={fetchRequests}>
                                <RefreshCcw className="h-4 w-4 mr-2" /> Check Again
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {requests.map((request) => (
                                <Card key={request.id} className="overflow-hidden border-2 hover:border-green-200 transition-all shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-stretch">
                                        {/* Status Sidebar */}
                                        <div className="bg-green-50 p-4 md:w-48 flex flex-col justify-between border-b md:border-b-0 md:border-r border-green-200">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Inbound Transfer</span>
                                                <div className="font-mono text-sm font-bold truncate text-green-800">{request.requestNo}</div>
                                            </div>
                                            <div className="mt-4 md:mt-0">
                                                {request.status === 'PENDING' && (
                                                	<Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200 font-bold">
                                                		<Clock className="h-3 w-3 mr-1" /> Awaiting Release
                                                	</Badge>
                                                )}
                                                {request.status === 'SOURCE_APPROVED' && (
                                                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 font-bold">
                                                        <Clock className="h-3 w-3 mr-1" /> Ready to Receive
                                                    </Badge>
                                                )}
                                                {request.status === 'COMPLETED' && (
                                                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 font-bold">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                                                    </Badge>
                                                )}
                                                {request.status === 'REJECTED' && (
                                                    <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 font-bold">
                                                        Rejected
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <CardContent className="p-4 md:p-6 flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex-1 w-full space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                                        <ArrowDown className="h-6 w-6" />
                                                    </div>
                                                     <div>
                                                         <div className="flex items-center gap-2 flex-wrap mb-1">
                                                             <h3 className="font-bold text-lg leading-tight">
                                                                 {request.items[0]?.item?.description || "Incoming Items"}
                                                             </h3>
                                                             {request.items[0]?.item?.size && (
                                                                 <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                                                                     Size: {request.items[0]?.item?.size.name || request.items[0]?.item?.size}
                                                                 </Badge>
                                                             )}
                                                             {request.items[0]?.item?.color && (
                                                                 <Badge variant="secondary" className="text-[10px] font-semibold bg-pink-50 text-pink-700 border-pink-200">
                                                                     Color: {request.items[0]?.item?.color.name || request.items[0]?.item?.color}
                                                                 </Badge>
                                                             )}
                                                         </div>
                                                         <p className="text-sm text-muted-foreground font-medium">SKU: {request.items[0]?.item?.sku || "N/A"}</p>
                                                     </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Incoming Quantity</span>
                                                        <span className="text-xl font-black text-green-600">{Number(request.items[0]?.quantity || 0)}</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                     <div className="flex flex-col">
                                                         <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source Location</span>
                                                         <span className="text-sm font-semibold">{request.fromLocation?.name || "Source Outlet"}</span>
                                                     </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
															{request.status === 'PENDING' ? 'Requested Date' : 'Approved Date'}
														</span>
                                                        <span className="text-sm font-semibold">{format(new Date(request.sourceApprovedAt || request.createdAt), "dd MMM yyyy HH:mm")}</span>
                                                    </div>
                                                </div>

                                                {request.notes && (
                                                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-green-700 block mb-1">Transfer Notes</span>
                                                        <p className="text-sm text-green-800">{request.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full md:w-auto flex flex-col gap-2">
                                                {activeTab === 'pending' && request.status === 'SOURCE_APPROVED' && (
                                                    <Button
                                                        className="w-full md:w-40 h-14 text-lg font-bold gap-2 shadow-lg shadow-green-200 bg-green-600 hover:bg-green-700"
                                                        disabled={isAccepting === request.id || !hasPermission('pos.inventory.inbound.accept')}
                                                        onClick={() => handleAccept(request.id)}
                                                    >
                                                        {isAccepting === request.id ? (
                                                            <RefreshCcw className="h-5 w-5 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        )}
                                                        {isAccepting === request.id ? "Accepting..." : "Accept Transfer"}
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    className="w-full md:w-40 h-10 font-bold gap-2 border-green-200 text-green-600 hover:bg-green-50"
                                                    disabled={printingId === request.id}
                                                    onClick={() => handlePrint(request)}
                                                >
                                                    <Printer className="h-4 w-4" /> Print Slip
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}