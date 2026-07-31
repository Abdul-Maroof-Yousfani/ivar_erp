"use client";

import React, { useState, useEffect } from "react";
import {
    PackageCheck,
    ArrowLeft,
    RefreshCcw,
    Package,
    ArrowRight,
    Search,
    Clock,
    CheckCircle2,
    FileText,
    Printer,
    Eye,
    AlertCircle,
    Check,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/providers/auth-provider";
import { getIncomingTransferRequests, acceptTransferRequest } from "@/lib/actions/transfer-request";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPANY_NAME } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StockReceivingPage() {
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);

    // Inspection & Custom Receiving state
    const [inspectingRequest, setInspectingRequest] = useState<any | null>(null);
    const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});
    const [receivingNotes, setReceivingNotes] = useState<string>("");

    const locationId = user?.terminal?.location?.id || user?.locationId;

    const fetchRequests = async () => {
        if (!locationId) return;
        setIsLoading(true);
        try {
            const res = await getIncomingTransferRequests(locationId);
            if (res.status) {
                setRequests(res.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch incoming transfers", error);
            toast.error("Failed to load incoming transfers");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [locationId]);

    const openInspectModal = (request: any) => {
        const initialMap: Record<string, number> = {};
        request.items?.forEach((item: any) => {
            initialMap[item.itemId] = Number(item.quantity || 0);
        });
        setReceivedQtyMap(initialMap);
        setReceivingNotes("");
        setInspectingRequest(request);
    };

    const handleAcceptDirect = async (request: any) => {
        setIsAccepting(request.id);
        try {
            const res = await acceptTransferRequest(request.id, user?.id);
            if (res.status) {
                toast.success("Stock accepted successfully!");
                setRequests(prev => prev.filter(r => r.id !== request.id));
            } else {
                toast.error(res.message || "Failed to accept stock");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to accept stock");
        } finally {
            setIsAccepting(null);
        }
    };

    const handleAcceptInspected = async () => {
        if (!inspectingRequest) return;

        const receivedItems = inspectingRequest.items.map((item: any) => ({
            itemId: item.itemId,
            receivedQty: receivedQtyMap[item.itemId] !== undefined ? Number(receivedQtyMap[item.itemId]) : Number(item.quantity),
        }));

        setIsAccepting(inspectingRequest.id);
        try {
            const res = await acceptTransferRequest(inspectingRequest.id, user?.id, receivedItems, receivingNotes);
            if (res.status) {
                toast.success("Stock accepted with receiving note successfully!");
                setRequests(prev => prev.filter(r => r.id !== inspectingRequest.id));
                setInspectingRequest(null);
            } else {
                toast.error(res.message || "Failed to accept stock");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to accept stock");
        } finally {
            setIsAccepting(null);
        }
    };

    const handlePrint = (request: any) => {
        setPrintingId(request.id);
        setTimeout(() => {
            const win = window.open("", "_blank", "width=800,height=800");
            if (!win) {
                toast.error("Allow popups to print");
                setPrintingId(null);
                return;
            }

            const totalSent = request.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
            const totalReceived = request.items?.reduce((sum: number, i: any) => {
                const rx = i.fulfilledQty !== null && i.fulfilledQty !== undefined ? Number(i.fulfilledQty) : Number(i.quantity);
                return sum + rx;
            }, 0);
            const totalVariance = totalReceived - totalSent;

            win.document.write(`
                <html>
                <head>
                    <title>Goods Receiving Note - ${request.requestNo}</title>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: 'Courier New', Courier, monospace; color: #000; padding: 20px; line-height: 1.4; font-size: 13px; }
                        .header { display: flex; justify-content: space-between; border-b: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
                        .logo-section h1 { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
                        .logo-section p { font-size: 11px; text-transform: uppercase; color: #555; font-weight: bold; }
                        .company-details { text-align: right; }
                        .company-name { font-size: 18px; font-weight: bold; }
                        .company-sub { font-size: 11px; color: #555; }
                        
                        .info-grid { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px; }
                        .info-card { border: 1px solid #000; padding: 12px; flex: 1; }
                        .info-card h3 { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-b: 1px solid #000; padding-bottom: 4px; }
                        .info-row { display: flex; margin-bottom: 4px; }
                        .info-label { width: 100px; font-weight: bold; }
                        .info-value { flex: 1; }
                        .info-value-bold { font-weight: bold; }
                        
                        .loc-grid { display: flex; flex-direction: column; gap: 8px; flex: 1; }
                        .loc-card { border: 1px solid #000; padding: 8px 12px; }
                        .loc-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; }
                        .loc-name { font-size: 13px; font-weight: bold; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background: #eee; color: #000; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #000; font-size: 11px; text-transform: uppercase; }
                        td { padding: 8px; border: 1px solid #000; font-size: 12px; }
                        .col-num { text-align: center; width: 30px; }
                        .col-sku { font-family: monospace; font-weight: bold; }
                        .col-qty { text-align: right; font-weight: bold; width: 70px; }
                        
                        .total-row { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-bottom: 30px; font-size: 13px; font-weight: bold; }
                        .total-val { font-size: 16px; border-bottom: 2px double #000; padding: 0 4px; }
                        
                        .notes-section { border: 1px dashed #000; padding: 10px; margin-bottom: 30px; font-size: 12px; }
                        .notes-title { font-weight: bold; text-transform: uppercase; margin-bottom: 4px; font-size: 10px; }
                        
                        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
                        .sig-line { text-align: center; flex: 1; }
                        .sig-placeholder { border-bottom: 1px solid #000; width: 80%; margin: 0 auto 6px; height: 30px; }
                        .sig-title { font-size: 11px; font-weight: bold; text-transform: uppercase; }
                        .sig-subtitle { font-size: 9px; color: #555; }
                        
                        .footer-note { text-align: center; font-size: 10px; color: #555; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo-section">
                            <h1>GOODS RECEIVING NOTE (GRN)</h1>
                            <p>Stock Transfer Receipt Verification</p>
                        </div>
                        <div class="company-details">
                            <div class="company-name">${COMPANY_NAME}</div>
                            <div class="company-sub">Receiving Slip Document</div>
                        </div>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-card">
                            <h3>Transfer Details</h3>
                            <div class="info-row">
                                <span class="info-label">Challan No:</span>
                                <span class="info-value info-value-bold">${request.requestNo}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Sent Date:</span>
                                <span class="info-value">${format(new Date(request.createdAt), "dd MMM yyyy HH:mm")}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Status:</span>
                                <span class="info-value" style="text-transform: uppercase;">${request.status}</span>
                            </div>
                        </div>
                        
                        <div class="loc-grid">
                            <div class="loc-card">
                                <div class="loc-title">From (Origin)</div>
                                <div class="loc-name">${request.fromWarehouse?.name || request.fromLocation?.name || "Main Warehouse"}</div>
                            </div>
                            <div class="loc-card">
                                <div class="loc-title">To (Destination)</div>
                                <div class="loc-name">${request.toLocation?.name || "Outlet Location"}</div>
                            </div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th class="col-num">#</th>
                                <th>SKU</th>
                                <th>Description</th>
                                <th style="text-align: right;">Sent Qty</th>
                                <th style="text-align: right;">Received Qty</th>
                                <th style="text-align: right;">Variance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${request.items.map((item: any, index: number) => {
                                const sent = Number(item.quantity || 0);
                                const rx = item.fulfilledQty !== null && item.fulfilledQty !== undefined ? Number(item.fulfilledQty) : sent;
                                const diff = rx - sent;
                                return `
                                    <tr>
                                        <td class="col-num">${index + 1}</td>
                                        <td class="col-sku">${item.item?.sku || "—"}</td>
                                        <td>${item.item?.description || "Item"}</td>
                                        <td class="col-qty">${sent}</td>
                                        <td class="col-qty" style="color: ${diff < 0 ? 'red' : 'black'};">${rx}</td>
                                        <td class="col-qty" style="color: ${diff < 0 ? 'red' : diff > 0 ? 'green' : 'gray'};">
                                            ${diff > 0 ? `+${diff}` : diff}
                                        </td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                    
                    <div class="total-row">
                        <span>Total Sent: <span class="total-val">${totalSent}</span></span>
                        <span>Total Received: <span class="total-val">${totalReceived}</span></span>
                        <span>Variance: <span class="total-val" style="color: ${totalVariance < 0 ? 'red' : 'black'};">${totalVariance > 0 ? `+${totalVariance}` : totalVariance}</span></span>
                    </div>
                    
                    ${request.notes ? `
                        <div class="notes-section">
                            <div class="notes-title">Remarks / Notes</div>
                            <div>${request.notes}</div>
                        </div>
                    ` : ""}
                    
                    <div class="signatures">
                        <div class="sig-line">
                            <div class="sig-placeholder"></div>
                            <div class="sig-title">Dispatched By</div>
                            <div class="sig-subtitle">Warehouse / Sign & Stamp</div>
                        </div>
                        <div class="sig-line">
                            <div class="sig-placeholder"></div>
                            <div class="sig-title">Delivered By</div>
                            <div class="sig-subtitle">Driver / Vehicle No.</div>
                        </div>
                        <div class="sig-line">
                            <div class="sig-placeholder"></div>
                            <div class="sig-title">Received By</div>
                            <div class="sig-subtitle">Store Manager / Sign</div>
                        </div>
                    </div>
                    
                    <div class="footer-note">
                        This is a computer-generated receiving document. Verify physical stock against quantities before signing.
                    </div>
                    <script>
                        window.onload = function() {
                            window.focus();
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
                </html>
            `);
            win.document.close();
            setPrintingId(null);
        }, 100);
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
                        <h1 className="text-2xl font-bold tracking-tight">Stock Receiving</h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                            Accept incoming warehouse transfers for
                            <Badge variant="outline" className="ml-1 font-bold text-primary">
                                {user?.terminal?.location?.name || "This Location"}
                            </Badge>
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
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : requests.length === 0 ? (
                        <Card className="border-dashed h-[400px] flex flex-col items-center justify-center text-center p-8 bg-muted/5">
                            <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                                <PackageCheck className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                            <CardTitle className="text-xl mb-2 text-muted-foreground">No Incoming Stock</CardTitle>
                            <CardDescription className="max-w-xs mx-auto">
                                All transfers have been processed. New transfers will appear here once initiated from the warehouse.
                            </CardDescription>
                            <Button variant="outline" className="mt-6" onClick={fetchRequests}>
                                <RefreshCcw className="h-4 w-4 mr-2" /> Check Again
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {requests.map((request) => {
                                const totalQty = request.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                                const itemCount = request.items?.length || 0;

                                return (
                                    <Card key={request.id} className="overflow-hidden border-2 hover:border-primary/20 transition-all shadow-sm !py-0">
                                        <div className="flex flex-col md:flex-row md:items-stretch">
                                            {/* Status Sidebar */}
                                            <div className="bg-primary/5 p-4 md:w-48 flex flex-col justify-between border-b md:border-b-0 md:border-r border-primary/10">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Request No</span>
                                                    <div className="font-mono text-sm font-bold truncate">{request.requestNo}</div>
                                                </div>
                                                <div className="mt-4 md:mt-0">
                                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200">
                                                        <Clock className="h-3 w-3 mr-1" /> Pending
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <CardContent className="p-4 md:p-6 flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
                                                <div className="flex-1 w-full space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                                            <Package className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg leading-tight">
                                                                {itemCount === 1 
                                                                    ? (request.items[0]?.item?.description || "Inventory Item")
                                                                    : `${itemCount} Items Batch Transfer`}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground font-medium">
                                                                {itemCount === 1 
                                                                    ? `SKU: ${request.items[0]?.item?.sku || "N/A"}`
                                                                    : `${request.items.map((i: any) => i.item?.sku).filter(Boolean).slice(0, 3).join(", ")}${itemCount > 3 ? "..." : ""}`}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Quantity</span>
                                                            <span className="text-xl font-black text-primary">{totalQty}</span>
                                                        </div>
                                                        <div className="h-10 w-px bg-border hidden sm:block" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Item Lines</span>
                                                            <span className="text-sm font-semibold">{itemCount} items</span>
                                                        </div>
                                                        <div className="h-10 w-px bg-border hidden sm:block" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source</span>
                                                            <span className="text-sm font-semibold">{request.fromLocation?.name || request.fromWarehouse?.name || "Main Warehouse"}</span>
                                                        </div>
                                                        <div className="h-10 w-px bg-border hidden sm:block" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sent Date</span>
                                                            <span className="text-sm font-semibold">{format(new Date(request.createdAt), "dd MMM yyyy HH:mm")}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-full md:w-auto flex flex-col gap-2">
                                                    <Button
                                                        className="w-full md:w-44 h-12 text-base font-bold gap-2 shadow-md"
                                                        disabled={isAccepting === request.id || !hasPermission('pos.inventory.receiving.accept')}
                                                        onClick={() => openInspectModal(request)}
                                                    >
                                                        <Eye className="h-5 w-5" />
                                                        Inspect & Receive
                                                    </Button>
                                                    
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1 font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                                                            disabled={isAccepting === request.id || !hasPermission('pos.inventory.receiving.accept')}
                                                            onClick={() => handleAcceptDirect(request)}
                                                        >
                                                            {isAccepting === request.id ? (
                                                                <RefreshCcw className="h-4 w-4 animate-spin mr-1" />
                                                            ) : (
                                                                <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />
                                                            )}
                                                            Quick Accept
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="font-semibold gap-1"
                                                            onClick={() => handlePrint(request)}
                                                            disabled={printingId === request.id}
                                                        >
                                                            {printingId === request.id ? (
                                                                <RefreshCcw className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Printer className="h-4 w-4" />
                                                            )}
                                                            Slip
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Inspect & Custom Receiving Modal */}
            <Dialog open={!!inspectingRequest} onOpenChange={(open) => !open && setInspectingRequest(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Package className="h-6 w-6 text-primary" />
                            Receiving Stock Inspection — {inspectingRequest?.requestNo}
                        </DialogTitle>
                        <DialogDescription>
                            Verify sent quantities vs. actual physical stock received. Enter receiving notes if there is a discrepancy.
                        </DialogDescription>
                    </DialogHeader>

                    {inspectingRequest && (
                        <div className="flex-1 overflow-y-auto space-y-4 my-2 pr-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg text-xs font-semibold">
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">From</span>
                                    <span>{inspectingRequest.fromLocation?.name || inspectingRequest.fromWarehouse?.name || "Main Warehouse"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Date Sent</span>
                                    <span>{format(new Date(inspectingRequest.createdAt), "dd MMM yyyy, HH:mm")}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Destination</span>
                                    <span>{user?.terminal?.location?.name || "This Store"}</span>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-muted/80 font-bold uppercase text-[10px] tracking-wider text-muted-foreground">
                                        <tr>
                                            <th className="p-3">Item / SKU</th>
                                            <th className="p-3 text-center">Dispatched Qty</th>
                                            <th className="p-3 text-center w-36">Received Qty</th>
                                            <th className="p-3 text-right">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {inspectingRequest.items?.map((item: any) => {
                                            const dispatched = Number(item.quantity || 0);
                                            const rxQty = receivedQtyMap[item.itemId] !== undefined ? receivedQtyMap[item.itemId] : dispatched;
                                            const diff = rxQty - dispatched;

                                            return (
                                                <tr key={item.id} className="hover:bg-muted/20">
                                                    <td className="p-3">
                                                        <div className="font-bold text-sm">{item.item?.description || "Item"}</div>
                                                        <div className="font-mono text-muted-foreground text-[11px]">SKU: {item.item?.sku || "N/A"}</div>
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-base">
                                                        {dispatched}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Input
                                                            type="number"
                                                            step="1"
                                                            value={receivedQtyMap[item.itemId] ?? dispatched}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setReceivedQtyMap(prev => ({ ...prev, [item.itemId]: val }));
                                                            }}
                                                            className="w-24 mx-auto text-center font-bold text-sm h-9"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right font-bold">
                                                        {diff === 0 ? (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Match (0)</Badge>
                                                        ) : diff < 0 ? (
                                                            <Badge variant="secondary" className="bg-rose-100 text-rose-700 border-rose-200">Shortage ({diff})</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Excess (+{diff})</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="receivingNotes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receiving Notes / Remarks (Optional)</Label>
                                <Input
                                    id="receivingNotes"
                                    placeholder="Add any remarks regarding damaged items, shortages, or delivery condition..."
                                    value={receivingNotes}
                                    onChange={(e) => setReceivingNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
                        <Button variant="outline" onClick={() => setInspectingRequest(null)}>
                            Cancel
                        </Button>
                        <Button 
                            className="font-bold gap-2 shadow-md"
                            disabled={isAccepting === inspectingRequest?.id}
                            onClick={handleAcceptInspected}
                        >
                            {isAccepting === inspectingRequest?.id ? (
                                <RefreshCcw className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5" />
                            )}
                            Confirm & Receive Stock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
