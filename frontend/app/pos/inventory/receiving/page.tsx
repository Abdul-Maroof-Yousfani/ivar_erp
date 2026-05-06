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
    FileText
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
import Link from "next/link";

export default function StockReceivingPage() {
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);

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

    const handleAccept = async (requestId: string) => {
        setIsAccepting(requestId);
        try {
            const res = await acceptTransferRequest(requestId, user?.id);
            if (res.status) {
                toast.success("Stock accepted successfully!");
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                toast.error(res.message || "Failed to accept stock");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to accept stock");
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
                            {requests.map((request) => (
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
                                                            {request.items[0]?.item?.description || "Inventory Items"}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground font-medium">SKU: {request.items[0]?.item?.sku || "N/A"}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quantity</span>
                                                        <span className="text-xl font-black text-primary">{Number(request.items[0]?.quantity || 0)}</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source</span>
                                                        <span className="text-sm font-semibold">{request.fromLocation?.name || "Main Warehouse"}</span>
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
                                                    className="w-full md:w-40 h-14 text-lg font-bold gap-2 shadow-lg shadow-primary/20"
                                                    disabled={isAccepting === request.id || !hasPermission('pos.inventory.receiving.accept')}
                                                    onClick={() => handleAccept(request.id)}
                                                >
                                                    {isAccepting === request.id ? (
                                                        <RefreshCcw className="h-5 w-5 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    )}
                                                    {isAccepting === request.id ? "Accepting..." : "Accept"}
                                                </Button>
                                                <Button variant="outline" className="w-full md:w-40 h-10 font-semibold text-primary" asChild>
                                                    <Link href={`/erp/inventory/transactions/stock-transfer/slip/${request.id}`} target="_blank">
                                                        <FileText className="h-4 w-4 mr-2" /> View Slip
                                                    </Link>
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
