"use client";

import React, { useState, useEffect } from "react";
import {
    RotateCcw,
    ArrowLeft,
    RefreshCcw,
    Package,
    Clock,
    CheckCircle2,
    FileText,
    AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/providers/auth-provider";
import { getReturnTransferRequests, acceptTransferRequest } from "@/lib/actions/transfer-request";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function ReturnRequestsPage() {
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
            const res = await getReturnTransferRequests(locationId);
            if (res.status) {
                setRequests(res.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch return requests", error);
            toast.error("Failed to load return requests");
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
                toast.success("Return request approved! Items returned to warehouse.");
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                toast.error(res.message || "Failed to approve return");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to approve return");
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
                        <h1 className="text-2xl font-bold tracking-tight">Return Requests</h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                            Approve return requests to send items back to warehouse from
                            <Badge variant="outline" className="ml-1 font-bold text-orange-600">
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
                            <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                                <RotateCcw className="h-10 w-10 text-orange-600/60" />
                            </div>
                            <CardTitle className="text-xl mb-2 text-muted-foreground">No Return Requests</CardTitle>
                            <CardDescription className="max-w-xs mx-auto">
                                No pending return requests for this location. Return requests will appear here when created from ERP.
                            </CardDescription>
                            <Button variant="outline" className="mt-6" onClick={fetchRequests}>
                                <RefreshCcw className="h-4 w-4 mr-2" /> Check Again
                            </Button>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {requests.map((request) => (
                                <Card key={request.id} className="overflow-hidden border-2 hover:border-orange-200 transition-all shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-stretch">
                                        {/* Status Sidebar */}
                                        <div className="bg-orange-50 p-4 md:w-48 flex flex-col justify-between border-b md:border-b-0 md:border-r border-orange-200">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Return Request</span>
                                                <div className="font-mono text-sm font-bold truncate text-orange-800">{request.requestNo}</div>
                                            </div>
                                            <div className="mt-4 md:mt-0">
                                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200">
                                                    <AlertTriangle className="h-3 w-3 mr-1" /> Pending Approval
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <CardContent className="p-4 md:p-6 flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex-1 w-full space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                                                        <RotateCcw className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-lg leading-tight">
                                                            {request.items[0]?.item?.description || "Return Items"}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground font-medium">SKU: {request.items[0]?.item?.sku || "N/A"}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Return Quantity</span>
                                                        <span className="text-xl font-black text-orange-600">{Number(request.items[0]?.quantity || 0)}</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Destination</span>
                                                        <span className="text-sm font-semibold">Main Warehouse</span>
                                                    </div>
                                                    <div className="h-10 w-px bg-border hidden sm:block" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Request Date</span>
                                                        <span className="text-sm font-semibold">{format(new Date(request.createdAt), "dd MMM yyyy HH:mm")}</span>
                                                    </div>
                                                </div>

                                                {request.notes && (
                                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700 block mb-1">Return Reason</span>
                                                        <p className="text-sm text-orange-800">{request.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full md:w-auto flex flex-col gap-2">
                                                <Button
                                                    className="w-full md:w-40 h-14 text-lg font-bold gap-2 shadow-lg shadow-orange-200 bg-orange-600 hover:bg-orange-700"
                                                    disabled={isAccepting === request.id || !hasPermission('pos.inventory.returns.approve')}
                                                    onClick={() => handleAccept(request.id)}
                                                >
                                                    {isAccepting === request.id ? (
                                                        <RefreshCcw className="h-5 w-5 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    )}
                                                    {isAccepting === request.id ? "Approving..." : "Approve Return"}
                                                </Button>
                                                <Button variant="outline" className="w-full md:w-40 h-10 font-semibold text-orange-600 border-orange-200 hover:bg-orange-50" asChild>
                                                    <Link href={`/erp/inventory/transactions/return-transfer/slip/${request.id}`} target="_blank">
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