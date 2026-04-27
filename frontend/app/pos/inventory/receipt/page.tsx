"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    RefreshCcw, Printer, PackageCheck, ArrowLeft,
    CalendarDays, MapPin, Package, FileText, Boxes,
    ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { getTransferRequests } from "@/lib/actions/transfer-request";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface TransferItem {
    id: string;
    quantity: number;
    item?: { sku: string; description: string };
}

interface Transfer {
    id: string;
    requestNo: string;
    createdAt: string;
    updatedAt: string;
    status: string;
    transferType: string;
    notes?: string;
    toLocationId?: string;
    fromLocation?: { name: string };
    toLocation?: { id?: string; name: string };
    items: TransferItem[];
}

function getCookie(name: string): string {
    if (typeof document === "undefined") return "";
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
}

export default function StockReceiptPage() {
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const printRef = useRef<HTMLDivElement>(null);

    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const locationId = user?.terminal?.location?.id || (user as any)?.locationId;
    const locationName = user?.terminal?.location?.name || getCookie("locationName") || "Outlet";
    const companyName = getCookie("companyName") || "Store";

    const fetchReceipts = async () => {
        if (!locationId) return;
        setIsLoading(true);
        try {
            const res = await getTransferRequests({ status: "COMPLETED" });
            if (res.status) {
                // Show all completed transfers that came INTO this location
                // Covers: receiving (WAREHOUSE_TO_OUTLET), inbound (OUTLET_TO_OUTLET), returns accepted
                const incoming = (res.data || []).filter(
                    (t: Transfer) =>
                        t.status === "COMPLETED" &&
                        (t.toLocationId === locationId || t.toLocation?.id === locationId)
                );
                setTransfers(incoming);
            }
        } catch {
            toast.error("Failed to load receipts");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchReceipts(); }, [locationId]);

    const totalUnits = (t: Transfer) =>
        t.items.reduce((sum, i) => sum + Number(i.quantity), 0);

    const filtered = transfers.filter((t) => {
        const q = search.toLowerCase();
        return (
            t.requestNo?.toLowerCase().includes(q) ||
            t.fromLocation?.name?.toLowerCase().includes(q) ||
            t.items.some((i) => i.item?.sku?.toLowerCase().includes(q) || i.item?.description?.toLowerCase().includes(q))
        );
    });

    const handlePrint = (transfer: Transfer) => {
        setPrintingId(transfer.id);
        setTimeout(() => {
            const printContent = document.getElementById(`receipt-${transfer.id}`);
            if (!printContent) return;
            const win = window.open("", "_blank", "width=400,height=600");
            if (!win) { toast.error("Allow popups to print"); setPrintingId(null); return; }
            win.document.write(`
                <html><head><title>Stock Receipt - ${transfer.requestNo}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; width: 320px; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                    .row { display: flex; justify-content: space-between; margin: 3px 0; }
                    .label { color: #555; font-size: 10px; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                    th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
                    td { font-size: 11px; padding: 3px 0; vertical-align: top; }
                    td:last-child { text-align: right; }
                    .footer { margin-top: 16px; }
                    .sig { border-top: 1px solid #000; margin-top: 24px; padding-top: 4px; font-size: 10px; }
                </style></head><body>
                ${printContent.innerHTML}
                </body></html>
            `);
            win.document.close();
            win.focus();
            win.print();
            win.close();
            setPrintingId(null);
        }, 100);
    };

    return (
        <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
            {/* Header */}
            <header
                className="flex-none p-4 md:p-6 pb-4 border-b bg-muted/20 backdrop-blur-xl sticky z-10"
                style={{ top: "calc(var(--banner-height) + 4rem)" }}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <PackageCheck className="h-6 w-6 text-primary" />
                            Stock Receipts
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                            Accepted stock transfers — print receipt slips
                        </p>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchReceipts} disabled={isLoading}>
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                    <Input
                        placeholder="Search by ref no, location, or SKU…"
                        className="pl-9 h-10 bg-muted/30 border-border/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </header>

            {/* List */}
            <main className="flex-1 overflow-auto p-4 md:p-6 pb-20">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                        <div className="h-20 w-20 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                            <FileText className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <p className="font-semibold text-muted-foreground">No receipts found</p>
                        <p className="text-sm text-muted-foreground/60 mt-1">
                            Accepted transfers will appear here
                        </p>
                        <Button variant="outline" className="mt-4" onClick={fetchReceipts}>
                            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((transfer) => (
                            <Card key={transfer.id} className="overflow-hidden border-border/60">
                                {/* Main Row */}
                                <CardContent className="p-0">
                                    <div className="flex items-center gap-4 p-4">
                                        {/* Icon */}
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-none">
                                            <PackageCheck className="h-5 w-5 text-primary" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-bold text-sm">{transfer.requestNo}</span>
                                                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                                    Completed
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {transfer.transferType === "WAREHOUSE_TO_OUTLET" ? "Warehouse → Outlet"
                                                        : transfer.transferType === "OUTLET_TO_OUTLET" ? "Outlet → Outlet"
                                                        : transfer.transferType === "OUTLET_TO_WAREHOUSE" ? "Return"
                                                        : transfer.transferType}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    From: <span className="font-semibold text-foreground ml-1">{transfer.fromLocation?.name || "Warehouse"}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Boxes className="h-3 w-3" />
                                                    {totalUnits(transfer)} units · {transfer.items.length} SKUs
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {format(new Date(transfer.updatedAt || transfer.createdAt), "dd MMM yyyy")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-none">
                                            <Button
                                                size="sm"
                                                className="gap-1.5 font-semibold"
                                                onClick={() => handlePrint(transfer)}
                                                disabled={printingId === transfer.id || !hasPermission('pos.inventory.receipt.view')}
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                Print
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setExpandedId(expandedId === transfer.id ? null : transfer.id)}
                                            >
                                                {expandedId === transfer.id
                                                    ? <ChevronUp className="h-4 w-4" />
                                                    : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded Items */}
                                    {expandedId === transfer.id && (
                                        <>
                                            <Separator />
                                            <div className="px-4 py-3 bg-muted/10">
                                                <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Item</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Qty</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {transfer.items.map((item) => (
                                                        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                                            <div>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{item.item?.sku}</span>
                                                                <p className="text-sm font-medium truncate">{item.item?.description}</p>
                                                            </div>
                                                            <span className="font-bold font-mono text-sm text-right">{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {transfer.notes && (
                                                    <div className="mt-3 p-2 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                                                        <span className="font-bold uppercase tracking-widest block mb-0.5">Notes</span>
                                                        {transfer.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </CardContent>

                                {/* Hidden print template */}
                                <div id={`receipt-${transfer.id}`} style={{ display: "none" }}>
                                    <div className="center bold" style={{ fontSize: 14 }}>{companyName}</div>
                                    <div className="center" style={{ fontSize: 11 }}>STOCK RECEIPT</div>
                                    <div className="divider" />
                                    <div className="row"><span className="label">Receipt Ref</span><span className="bold">{transfer.requestNo}</span></div>
                                    <div className="row"><span className="label">Date</span><span>{format(new Date(transfer.updatedAt || transfer.createdAt), "dd MMM yyyy HH:mm")}</span></div>
                                    <div className="row"><span className="label">Location</span><span>{locationName}</span></div>
                                    <div className="row"><span className="label">Received From</span><span>{transfer.fromLocation?.name || "Warehouse"}</span></div>
                                    <div className="divider" />
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>SKU</th>
                                                <th>Description</th>
                                                <th style={{ textAlign: "right" }}>Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transfer.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td style={{ fontSize: 10 }}>{item.item?.sku || "—"}</td>
                                                    <td>{item.item?.description || "Item"}</td>
                                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="divider" />
                                    <div className="row bold"><span>Total Units</span><span>{totalUnits(transfer)}</span></div>
                                    {transfer.notes && (
                                        <>
                                            <div className="divider" />
                                            <div className="label">Notes</div>
                                            <div style={{ fontSize: 11, marginTop: 2 }}>{transfer.notes}</div>
                                        </>
                                    )}
                                    <div className="footer">
                                        <div className="sig">Received By: ___________________</div>
                                        <div className="sig" style={{ marginTop: 16 }}>Authorized By: ________________</div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
