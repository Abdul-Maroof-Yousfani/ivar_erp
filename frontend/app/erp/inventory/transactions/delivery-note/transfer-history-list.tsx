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
import { Card, CardContent } from "@/components/ui/card";
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
    RefreshCw
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

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PENDING':
                return (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200 gap-1 capitalize">
                        <Clock className="h-3 w-3" /> {status.toLowerCase()}
                    </Badge>
                );
            case 'COMPLETED':
                return (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 gap-1 capitalize">
                        <CheckCircle2 className="h-3 w-3" /> {status.toLowerCase()}
                    </Badge>
                );
            case 'CANCELLED':
                return (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 gap-1 capitalize">
                        <XCircle className="h-3 w-3" /> {status.toLowerCase()}
                    </Badge>
                );
            default:
                return <Badge variant="outline" className="capitalize">{status.toLowerCase()}</Badge>;
        }
    };

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
                                    <SelectItem value="PENDING">Pending</SelectItem>
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

            {/* Table */}
            <Card className="overflow-hidden shadow-xs border-2 py-0!">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-bold"><Hash className="h-4 w-4 inline mr-1" /> Request No</TableHead>
                                <TableHead className="font-bold"><Calendar className="h-4 w-4 inline mr-1" /> Date</TableHead>
                                <TableHead className="font-bold"><ArrowRightLeft className="h-4 w-4 inline mr-1" /> Transfer Path</TableHead>
                                <TableHead className="font-bold"><Package className="h-4 w-4 inline mr-1" /> Item Details</TableHead>
                                <TableHead className="font-bold text-center">Qty</TableHead>
                                <TableHead className="font-bold">Status</TableHead>
                                <TableHead className="font-bold text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No delivery notes found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((transfer) => (
                                    <TableRow key={transfer.id} className={`hover:bg-muted/50 transition-colors ${transfer.transferType === 'OUTLET_TO_WAREHOUSE' ? 'bg-orange-50/30' : ''}`}>
                                        <TableCell className="font-mono font-bold text-sm">
                                            <div className="flex items-center gap-2">
                                                {transfer.transferType === 'OUTLET_TO_WAREHOUSE' && (
                                                    <RotateCcw className="h-4 w-4 text-orange-600" />
                                                )}
                                                {transfer.requestNo}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {format(new Date(transfer.createdAt), "dd MMM yyyy, HH:mm")}
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
                                                            <span className="text-muted-foreground">{transfer.fromWarehouse?.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                                            <Badge variant="outline" className="px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">TO</Badge>
                                                            <span className="font-bold">{transfer.toLocation?.name || transfer.toWarehouse?.name}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {transfer.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex flex-col mb-1.5 last:mb-0">
                                                    <span className="font-bold text-sm leading-tight">{item.item?.description}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                                        SKU: {item.item?.sku}
                                                        {item.item?.color?.name && ` • Color: ${item.item.color.name}`}
                                                        {item.item?.size?.name && ` • Size: ${item.item.size.name}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </TableCell>
                                        <TableCell className="text-center font-black text-primary">
                                            {transfer.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(transfer.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/erp/inventory/transactions/stock-transfer/slip/${transfer.id}`} target="_blank">
                                                    <Printer className="h-4 w-4 mr-2" />
                                                    Print
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
