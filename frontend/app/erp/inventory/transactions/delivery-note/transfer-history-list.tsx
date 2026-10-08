"use client";

import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    ArrowRightLeft,
    Calendar,
    Hash,
    Printer,
    RotateCcw,
    Loader2,
    Download,
    Search,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Eye,
    Layers,
    Boxes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getStockTransfers, queueDeliveryNotesExport } from "@/lib/actions/stock-transfer";
import { Warehouse } from "@/lib/actions/warehouse";
import { cn } from "@/lib/utils";

interface StockTransferHistoryListProps {
    initialEntries: any[];
    warehouses?: Warehouse[];
    initialFilters?: {
        warehouseId?: string;
        status?: string;
        transferType?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
    };
}

export function StockTransferHistoryList({ 
    initialEntries,
    warehouses = [],
    initialFilters
}: StockTransferHistoryListProps) {
    const router = useRouter();
    const [entries, setEntries] = React.useState<any[]>(initialEntries);
    const [loading, setLoading] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = React.useState(1);
    const pageSize = 10;

    // Detailed Item Inspection State
    const [selectedTransferForDetails, setSelectedTransferForDetails] = React.useState<any | null>(null);

    // Filter states
    const [search, setSearch] = React.useState(initialFilters?.search || "");
    const [status, setStatus] = React.useState(initialFilters?.status || "all");
    const [transferType, setTransferType] = React.useState(initialFilters?.transferType || "all");
    const [warehouseId, setWarehouseId] = React.useState(initialFilters?.warehouseId || "all");
    const [dateFrom, setDateFrom] = React.useState(initialFilters?.dateFrom || "");
    const [dateTo, setDateTo] = React.useState(initialFilters?.dateTo || "");

    // Keep state in sync with initialEntries when props update
    React.useEffect(() => {
        setEntries(initialEntries);
        setCurrentPage(1);
    }, [initialEntries]);

    const applyFilters = async () => {
        setLoading(true);
        try {
            const activeFilters = {
                search: search.trim() || undefined,
                status: status !== "all" ? status : undefined,
                transferType: transferType !== "all" ? transferType : undefined,
                warehouseId: warehouseId !== "all" ? warehouseId : undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            };

            const res = await getStockTransfers(activeFilters);
            if (res.status) {
                setEntries(res.data || []);
                setCurrentPage(1);
                
                const params = new URLSearchParams();
                if (activeFilters.search) params.set("search", activeFilters.search);
                if (activeFilters.status) params.set("status", activeFilters.status);
                if (activeFilters.transferType) params.set("transferType", activeFilters.transferType);
                if (activeFilters.warehouseId) params.set("warehouseId", activeFilters.warehouseId);
                if (activeFilters.dateFrom) params.set("dateFrom", activeFilters.dateFrom);
                if (activeFilters.dateTo) params.set("dateTo", activeFilters.dateTo);
                
                const qs = params.toString();
                router.replace(`/erp/inventory/transactions/delivery-note${qs ? `?${qs}` : ""}`, { scroll: false });
                toast.success("Filters applied successfully");
            } else {
                toast.error(res.message || "Failed to fetch filtered delivery notes");
            }
        } catch (error) {
            console.error("Error applying filters:", error);
            toast.error("Failed to filter delivery notes");
        } finally {
            setLoading(false);
        }
    };

    const resetFilters = async () => {
        setSearch("");
        setStatus("all");
        setTransferType("all");
        setWarehouseId("all");
        setDateFrom("");
        setDateTo("");
        setLoading(true);
        try {
            const res = await getStockTransfers();
            if (res.status) {
                setEntries(res.data || []);
                setCurrentPage(1);
                router.replace("/erp/inventory/transactions/delivery-note", { scroll: false });
                toast.success("Filters reset successfully");
            } else {
                toast.error(res.message || "Failed to reset delivery notes");
            }
        } catch (error) {
            console.error("Error resetting filters:", error);
            toast.error("Failed to reset filters");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        const toastId = toast.loading("Queuing delivery notes export job...");
        try {
            const activeFilters = {
                search: search.trim() || undefined,
                status: status !== "all" ? status : undefined,
                transferType: transferType !== "all" ? transferType : undefined,
                warehouseId: warehouseId !== "all" ? warehouseId : undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            };

            const result = await queueDeliveryNotesExport(activeFilters);
            toast.dismiss(toastId);
            if (result.status && result.data) {
                toast.success("Excel export job successfully queued! Check your notification bell in a moment to download.");
            } else {
                toast.error(result.message || "Failed to queue export job.");
            }
        } catch (error: any) {
            toast.dismiss(toastId);
            toast.error(error.message || "Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const getStatusBadge = (statusStr: string) => {
        const s = statusStr.toUpperCase();
        switch (s) {
            case 'PENDING_CHECKER':
                return (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100/80 border-amber-200 gap-1 capitalize">
                        <Clock className="h-3 w-3" /> pending checker
                    </Badge>
                );
            case 'PENDING_AUTHORIZER':
                return (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200 gap-1 capitalize">
                        <Clock className="h-3 w-3" /> pending authorizer
                    </Badge>
                );
            case 'SOURCE_APPROVED':
                return (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100/80 border-purple-200 gap-1 capitalize">
                        <CheckCircle2 className="h-3 w-3" /> source approved
                    </Badge>
                );
            case 'PENDING':
                return (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200 gap-1 capitalize">
                        <Clock className="h-3 w-3" /> pending
                    </Badge>
                );
            case 'PARTIAL_RECEIVED':
                return (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-300 gap-1 capitalize font-bold">
                        <Clock className="h-3 w-3 text-amber-600" /> partial received
                    </Badge>
                );
            case 'COMPLETED':
                return (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 border-emerald-300 gap-1 capitalize font-bold">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> completed
                    </Badge>
                );
            case 'REJECTED':
                return (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 gap-1 capitalize">
                        <XCircle className="h-3 w-3" /> rejected
                    </Badge>
                );
            case 'CANCELLED':
                return (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 gap-1 capitalize">
                        <XCircle className="h-3 w-3" /> cancelled
                    </Badge>
                );
            default:
                return <Badge variant="outline" className="capitalize">{statusStr.toLowerCase()}</Badge>;
        }
    };

    // Calculate pagination slices
    const totalEntries = entries.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const paginatedEntries = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return entries.slice(start, start + pageSize);
    }, [entries, currentPage, pageSize]);

    // Date Grouping logic on paginated entries
    const groupedPaginatedEntries = React.useMemo(() => {
        const groups: { [dateKey: string]: any[] } = {};
        paginatedEntries.forEach((t) => {
            const dKey = format(new Date(t.createdAt), "yyyy-MM-dd");
            if (!groups[dKey]) groups[dKey] = [];
            groups[dKey].push(t);
        });

        return Object.entries(groups).map(([dKey, groupItems]) => {
            const sentQty = groupItems.reduce((acc, t) => acc + t.items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0), 0);
            const rxQty = groupItems.reduce((acc, t) => acc + t.items.reduce((s: number, i: any) => {
                const r = i.fulfilledQty !== null && i.fulfilledQty !== undefined ? Number(i.fulfilledQty) : (t.status === 'COMPLETED' ? Number(i.quantity || 0) : 0);
                return s + r;
            }, 0), 0);

            return {
                dateKey: dKey,
                formattedDate: format(new Date(dKey), "dd MMMM yyyy"),
                notesCount: groupItems.length,
                totalSentQty: sentQty,
                totalRxQty: rxQty,
                items: groupItems,
            };
        });
    }, [paginatedEntries]);

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <Card className="border-2 shadow-xs">
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="search" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Search Request No</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="TR-..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="PENDING">Pending (All)</SelectItem>
                                    <SelectItem value="PENDING_CHECKER">Pending Checker</SelectItem>
                                    <SelectItem value="PENDING_AUTHORIZER">Pending Authorizer</SelectItem>
                                    <SelectItem value="SOURCE_APPROVED">Source Approved</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Transfer Type</Label>
                            <Select value={transferType} onValueChange={setTransferType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="WAREHOUSE_TO_OUTLET">Warehouse to Outlet</SelectItem>
                                    <SelectItem value="OUTLET_TO_WAREHOUSE">Outlet to Warehouse</SelectItem>
                                    <SelectItem value="OUTLET_TO_OUTLET">Outlet to Outlet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Source Warehouse</Label>
                            <Select value={warehouseId} onValueChange={setWarehouseId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Warehouses</SelectItem>
                                    {warehouses?.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name} ({w.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="dateFrom" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date From</Label>
                            <Input
                                id="dateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="dateTo" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date To</Label>
                            <Input
                                id="dateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-dashed">
                        <div className="flex gap-2">
                            <Button onClick={applyFilters} disabled={loading} size="sm" className="font-semibold shadow-xs">
                                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                                {loading ? "Applying..." : "Apply Filters"}
                            </Button>
                            <Button onClick={resetFilters} variant="outline" size="sm" className="font-semibold shadow-xs" disabled={loading}>
                                Reset
                            </Button>
                        </div>

                        <Button
                            variant="outline"
                            onClick={handleExport}
                            disabled={isExporting || entries.length === 0}
                            size="sm"
                            className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 font-bold shadow-xs"
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            {isExporting ? "Exporting..." : "Export to Excel"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Date Grouped Delivery Notes Container */}
            <div className="space-y-6">
                {totalEntries === 0 ? (
                    <Card className="p-8 text-center border-dashed">
                        <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-muted-foreground">No Delivery Notes Found</h3>
                        <p className="text-xs text-muted-foreground mt-1">Try resetting your filters or search terms.</p>
                    </Card>
                ) : (
                    groupedPaginatedEntries.map((group) => (
                        <Card key={group.dateKey} className="overflow-hidden border-2 shadow-xs py-0!">
                            {/* Group Header */}
                            <CardHeader className="bg-muted/40 p-4 border-b flex flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    <div>
                                        <CardTitle className="text-base font-bold tracking-tight">
                                            {group.formattedDate}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {group.notesCount} Delivery Note{group.notesCount > 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-semibold">
                                    <div className="bg-background px-3 py-1.5 rounded-md border shadow-2xs">
                                        <span className="text-muted-foreground uppercase text-[10px] block font-bold">Total Sent Qty</span>
                                        <span className="font-bold text-sm text-primary">{group.totalSentQty}</span>
                                    </div>
                                    <div className="bg-background px-3 py-1.5 rounded-md border shadow-2xs">
                                        <span className="text-muted-foreground uppercase text-[10px] block font-bold">Total Received Qty</span>
                                        <span className="font-bold text-sm text-emerald-700">{group.totalRxQty}</span>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/20">
                                        <TableRow>
                                            <TableHead className="font-bold"><Hash className="h-4 w-4 inline mr-1" /> Request No</TableHead>
                                            <TableHead className="font-bold"><Clock className="h-4 w-4 inline mr-1" /> Time</TableHead>
                                            <TableHead className="font-bold"><ArrowRightLeft className="h-4 w-4 inline mr-1" /> Transfer Path</TableHead>
                                            <TableHead className="font-bold"><Boxes className="h-4 w-4 inline mr-1" /> Item Summary</TableHead>
                                            <TableHead className="font-bold text-center">Dispatched Qty</TableHead>
                                            <TableHead className="font-bold text-center">Received Qty</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="font-bold text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.items.map((transfer) => {
                                            const totalSent = transfer.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
                                            const totalRx = transfer.items?.reduce((sum: number, i: any) => {
                                                const r = i.fulfilledQty !== null && i.fulfilledQty !== undefined ? Number(i.fulfilledQty) : (transfer.status === 'COMPLETED' ? Number(i.quantity || 0) : null);
                                                return r !== null ? sum + r : sum;
                                            }, 0);
                                            const isRxCompleted = transfer.status === 'COMPLETED' || transfer.items?.some((i: any) => i.fulfilledQty !== null && i.fulfilledQty !== undefined);

                                            return (
                                                <TableRow key={transfer.id} className={`hover:bg-muted/50 transition-colors ${transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? 'bg-orange-50/20' : ''}`}>
                                                    <TableCell className="font-mono font-bold text-sm">
                                                        <div className="flex items-center gap-2">
                                                            {transfer.transferType === 'OUTLET_TO_WAREHOUSE' && (
                                                                <RotateCcw className="h-4 w-4 text-orange-600" />
                                                            )}
                                                            {transfer.requestNo}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium text-muted-foreground">
                                                        {format(new Date(transfer.createdAt), "HH:mm")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            {transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? (
                                                                <>
                                                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                                        <Badge variant="outline" className="px-1.5 py-0 h-5 bg-orange-50 text-orange-700 border-orange-200">FROM</Badge>
                                                                        <span className="text-muted-foreground">{transfer.fromLocation?.name || 'Outlet'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                                        <Badge variant="outline" className="px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">TO</Badge>
                                                                        <span className="font-bold">{transfer.fromWarehouse?.name || 'Main Warehouse'}</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                                        <Badge variant="outline" className="px-1.5 py-0 h-5 bg-background">FROM</Badge>
                                                                        <span className="text-muted-foreground">{transfer.fromWarehouse?.name || "Warehouse"}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                                        <Badge variant="outline" className="px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">TO</Badge>
                                                                        <span className="font-bold">{transfer.toLocation?.name || transfer.toWarehouse?.name || "Outlet"}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="font-bold bg-muted/80 text-foreground">
                                                                {transfer.items?.length || 0} {transfer.items?.length === 1 ? 'Line Item' : 'Line Items'}
                                                            </Badge>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs font-bold text-primary"
                                                                onClick={() => setSelectedTransferForDetails(transfer)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                                View Items
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-black text-primary text-base">
                                                        {totalSent}
                                                    </TableCell>
                                                    <TableCell className="text-center font-black text-base">
                                                        {isRxCompleted ? (
                                                            <span className="text-emerald-700">{totalRx}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs font-medium">Pending</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(transfer.status)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" asChild className="font-bold">
                                                            <Link href={`/erp/inventory/transactions/stock-transfer/slip/${transfer.id}`} target="_blank">
                                                                <Printer className="h-4 w-4 mr-1.5" />
                                                                Print DC
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalEntries > 0 && (
                <Card className="p-4 border-2 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-muted-foreground font-semibold">
                        Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                        <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, totalEntries)}</span> of{" "}
                        <span className="font-bold text-foreground">{totalEntries}</span> delivery notes
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            className="font-bold"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <div className="text-xs font-bold px-3 py-1 bg-muted/40 rounded-md">
                            Page {currentPage} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            className="font-bold"
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </Card>
            )}

            {/* Item Details Inspection Modal */}
            <Dialog open={!!selectedTransferForDetails} onOpenChange={(open) => !open && setSelectedTransferForDetails(null)}>
                <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Boxes className="h-6 w-6 text-primary" />
                            Item Breakdown — {selectedTransferForDetails?.requestNo}
                        </DialogTitle>
                        <DialogDescription>
                            Full breakdown of items dispatched and received for this delivery note.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedTransferForDetails && (
                        <div className="flex-1 overflow-y-auto overflow-x-auto space-y-4 my-2 pr-2">
                            <div className="border rounded-lg overflow-hidden min-w-max">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-muted/80 font-bold uppercase text-[10px] tracking-wider text-muted-foreground">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">Item SKU / Description</th>
                                            <th className="p-3">Barcode</th>
                                            <th className="p-3">Color</th>
                                            <th className="p-3">Size</th>
                                            <th className="p-3 text-right">Dispatched Qty</th>
                                            <th className="p-3 text-right">Received Qty</th>
                                            <th className="p-3 text-right">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedTransferForDetails.items?.map((item: any, idx: number) => {
                                            const dispatched = Number(item.quantity || 0);
                                            const rx = item.fulfilledQty !== null && item.fulfilledQty !== undefined
                                                ? Number(item.fulfilledQty)
                                                : (selectedTransferForDetails.status === 'COMPLETED' ? dispatched : null);
                                            const diff = rx !== null ? rx - dispatched : null;

                                            return (
                                                <tr key={item.id} className="hover:bg-muted/20">
                                                    <td className="p-3 text-muted-foreground">{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-sm">{item.item?.description || item.item?.name || "Item"}</div>
                                                        <div className="font-mono text-muted-foreground text-[11px]">SKU: {item.item?.sku || "N/A"}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-mono text-xs">{item.item?.barCode || "—"}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="text-xs">{item.item?.color?.name || "—"}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="text-xs">{item.item?.size?.name || "—"}</div>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-sm">
                                                        {dispatched}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-sm">
                                                        {rx !== null ? rx : <span className="text-muted-foreground text-xs font-normal">Pending</span>}
                                                    </td>
                                                    <td className="p-3 text-right font-bold">
                                                        {diff === null ? (
                                                            "—"
                                                        ) : diff === 0 ? (
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

                            {selectedTransferForDetails.notes && (
                                <div className="p-3 bg-muted/30 border rounded-lg text-xs">
                                    <span className="font-bold block uppercase text-[10px] text-muted-foreground mb-1">Notes & Remarks</span>
                                    <p className="whitespace-pre-wrap">{selectedTransferForDetails.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
