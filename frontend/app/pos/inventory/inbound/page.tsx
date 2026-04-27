"use client";

import React, { useState, useEffect } from "react";
import {
    ArrowDown,
    ArrowLeft,
    RefreshCcw,
    Package,
    CheckCircle2,
    FileText,
    Clock
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

    const locationId = user?.terminal?.location?.id || user?.locationId;

    const fetchRequests = async () => {
        if (!locationId) return;
        setIsLoading(true);
        try {
            const res = await getInboundTransferRequests(locationId);
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
    }, [locationId]);

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
                            <h2 className="text-xl mb-2 text-muted-foreground font-bold">No Inbound Transfers</h2>
                            <p className="max-w-xs mx-auto text-muted-foreground">
                                No pending inbound transfers for this location. Transfers will appear here after source approval.
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
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200">
                                                    <Clock className="h-3 w-3 mr-1" /> Ready to Receive
                                                </Badge>
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
                                                        <h3 className="font-bold text-lg leading-tight">
                                                            {request.items[0]?.item?.description || "Incoming Items"}
                                                        </h3>
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
                                                        <span className="text-sm font-semibold">Source Outlet</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Approved Date</span>
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
                                                <Button variant="outline" className="w-full md:w-40 h-10 font-semibold text-green-600 border-green-200 hover:bg-green-50" asChild>
                                                    <Link href={`/erp/inventory/transactions/outlet-transfer/slip/${request.id}`} target="_blank">
                                                        <FileText className="h-4 w-4 mr-2" /> View Details
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