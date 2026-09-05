"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import Link from "next/link";
import { Printer, Download, Eye, Pencil, CheckCircle2, XCircle, Store, Building2, Plus, FileCheck, CheckSquare, Loader2, RotateCcw } from "lucide-react";
import { ReceiptVoucher, updateReceiptVoucherStatus, bulkUpdateReceiptVoucherStatus, queueReceiptVouchersExport, unapproveReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { RetailSaleReceiptVoucherPrint } from "./retail-sale-receipt-voucher-print";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";

export function RetailSaleReceiptVoucherList({
    initialData,
    permissions,
}: {
    initialData: ReceiptVoucher[];
    permissions?: {
        canCreate: boolean;
        canRead: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canApprove: boolean;
    };
}) {
    const [statusTab, setStatusTab] = useState<string>("all");
    const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
    const [toDate, setToDate] = useState<Date | undefined>(undefined);
    const [vouchers, setVouchers] = useState<ReceiptVoucher[]>(initialData);
    const [printingVoucher, setPrintingVoucher] = useState<ReceiptVoucher | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setVouchers(initialData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialData]);

    useEffect(() => {
        const handleAfterPrint = () => setPrintingVoucher(null);
        window.addEventListener("afterprint", handleAfterPrint);
        return () => window.removeEventListener("afterprint", handleAfterPrint);
    }, []);

    const handlePrint = (voucher: ReceiptVoucher) => {
        setPrintingVoucher(voucher);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const result = await queueReceiptVouchersExport({
                type: "rs_rv",
                status: statusTab !== "all" ? statusTab : undefined,
                dateFrom: fromDate ? fromDate.toISOString().split("T")[0] : undefined,
                dateTo: toDate ? toDate.toISOString().split("T")[0] : undefined,
            });
            if (result.status) {
                toast.success("Export queued! You'll receive a notification when ready.");
            } else {
                toast.error(result.message || "Failed to queue export.");
            }
        } catch {
            toast.error("An unexpected error occurred while queuing export.");
        } finally {
            setIsExporting(false);
        }
    };

    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

    const handleUpdateStatus = async (
        id: string,
        newStatus: "draft" | "pending_check" | "pending_approval" | "approved" | "rejected"
    ) => {
        try {
            setUpdatingStatusId(id);
            const res = await updateReceiptVoucherStatus(id, newStatus);
            if (res.status) {
                toast.success(`Voucher status updated to ${newStatus.replace(/_/g, " ")}`);
                setVouchers(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
            } else {
                toast.error(res.message || "Failed to update status");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleUnapprove = async (id: string) => {
        if (updatingStatusId) return;
        try {
            setUpdatingStatusId(id);
            const res = await unapproveReceiptVoucher(id);
            if (res.status) {
                toast.success("Retail Sale Receipt Voucher unapproved & unposted successfully");
                setVouchers(prev => prev.map(v => v.id === id ? { ...v, status: "pending_check" as const } : v));
            } else {
                toast.error(res.message || "Failed to unapprove voucher");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleBulkUpdateStatus = async (
        newStatus: "pending_approval" | "approved" | "rejected"
    ) => {
        if (selectedIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            const res = await bulkUpdateReceiptVoucherStatus(selectedIds, newStatus);
            if (res.status) {
                toast.success(res.message);
                setVouchers(prev =>
                    prev.map(v => (selectedIds.includes(v.id) ? { ...v, status: newStatus } : v))
                );
                setSelectedIds([]);
            } else {
                toast.error(res.message || "Bulk update failed");
            }
        } catch {
            toast.error("An error occurred during bulk operation");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    // Filter data
    const filteredData = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return vouchers.filter(v => {
            const st = (v.status || "draft").toLowerCase();
            if (statusTab === "pending_check" && st !== "pending_check" && st !== "pending") return false;
            if (statusTab === "pending_approval" && st !== "pending_approval") return false;
            if (statusTab === "approved" && st !== "approved") return false;
            if (statusTab === "rejected" && st !== "rejected") return false;

            if (fromDate) {
                const vDate = new Date(v.rvDate);
                if (vDate < fromDate) return false;
            }
            if (toDate) {
                const vDate = new Date(v.rvDate);
                if (vDate > toDate) return false;
            }

            if (q) {
                const matchRvNo = v.rvNo?.toLowerCase().includes(q);
                const matchFolio = v.folio?.toLowerCase().includes(q);
                const matchDesc = v.description?.toLowerCase().includes(q);
                const matchRemarks = v.remarks?.toLowerCase().includes(q);
                const matchOutlet = v.details?.some(d =>
                    d.tagAccountName?.toLowerCase().includes(q) ||
                    d.tagAccountCode?.toLowerCase().includes(q) ||
                    d.narration?.toLowerCase().includes(q)
                );
                if (!matchRvNo && !matchFolio && !matchDesc && !matchRemarks && !matchOutlet) {
                    return false;
                }
            }

            return true;
        });
    }, [vouchers, statusTab, fromDate, toDate, searchQuery]);

    // Status tab counts
    const counts = useMemo(() => {
        let pendingCheck = 0;
        let pendingApproval = 0;
        let approved = 0;
        let rejected = 0;

        vouchers.forEach(v => {
            const st = (v.status || "draft").toLowerCase();
            if (st === "pending_check" || st === "pending") pendingCheck++;
            else if (st === "pending_approval") pendingApproval++;
            else if (st === "approved") approved++;
            else if (st === "rejected") rejected++;
        });

        return {
            all: vouchers.length,
            pendingCheck,
            pendingApproval,
            approved,
            rejected,
        };
    }, [vouchers]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredData.map(v => v.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(i => i !== id));
        }
    };

    const isAllSelected = filteredData.length > 0 && selectedIds.length === filteredData.length;
    const canCreate = true;
    const canUpdate = true;
    const canApprove = true;

    const columns: ColumnDef<ReceiptVoucher>[] = [
        {
            id: "select",
            header: () => (
                <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={selectedIds.includes(row.original.id)}
                    onCheckedChange={(checked) => handleSelectOne(row.original.id, !!checked)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "rvNo",
            header: "RSRV No",
            cell: ({ row }) => (
                <div className="font-semibold text-blue-700 font-mono text-xs">
                    <Link
                        href={`/erp/finance/retail-sale-receipt-voucher/${row.original.id}`}
                        className="hover:underline"
                    >
                        {row.original.rvNo}
                    </Link>
                    {row.original.folio && (
                        <div className="text-[10px] text-gray-500 font-sans">
                            Folio: <span className="font-mono text-gray-700">{row.original.folio}</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "outlet",
            header: "Outlet / Location",
            cell: ({ row }) => {
                const outletTag = row.original.details?.find(d => d.tagAccountCode || d.tagAccountName);
                const code = outletTag?.tagAccountCode;
                const name = outletTag?.tagAccountName;
                if (!code && !name) {
                    return <span className="text-gray-400 text-xs">—</span>;
                }
                return (
                    <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <div className="text-xs">
                            {code && <span className="font-bold text-gray-800 mr-1">[{code}]</span>}
                            <span className="font-medium text-gray-700">{name || "Outlet"}</span>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "description",
            header: "Description / Remarks",
            cell: ({ row }) => {
                const desc = row.original.description || row.original.remarks;
                if (!desc) {
                    return <span className="text-gray-400 text-xs">—</span>;
                }
                return (
                    <div className="text-xs text-gray-700 max-w-[240px] truncate font-medium" title={desc}>
                        {desc}
                    </div>
                );
            },
        },
        {
            accessorKey: "rvDate",
            header: "Date",
            cell: ({ row }) => (
                <div className="text-xs font-medium text-gray-700">
                    {row.original.rvDate ? format(new Date(row.original.rvDate), "dd-MMM-yyyy") : "—"}
                </div>
            ),
        },
        {
            accessorKey: "debitAmount",
            header: () => <div className="text-right">Amount (PKR)</div>,
            cell: ({ row }) => {
                const total = row.original.details?.reduce((sum, d) => sum + (Number(d.debit) || 0), 0) || row.original.debitAmount || 0;
                return (
                    <div className="text-right font-semibold text-xs tabular-nums">
                        {total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const st = (row.original.status || "draft").toLowerCase();
                const isApproved = st === "approved";
                const isPendingApproval = st === "pending_approval";
                const isPendingCheck = st === "pending_check" || st === "pending";
                const isRejected = st === "rejected";

                let badgeClass = "bg-slate-100 text-slate-700 border-slate-300";
                let label = "DRAFT";

                if (isApproved) {
                    badgeClass = "bg-green-50 text-green-700 border-green-200 font-bold";
                    label = "APPROVED";
                } else if (isPendingApproval) {
                    badgeClass = "bg-blue-50 text-blue-700 border-blue-200 font-bold";
                    label = "PENDING APPROVAL";
                } else if (isPendingCheck) {
                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                    label = "PENDING CHECK";
                } else if (isRejected) {
                    badgeClass = "bg-red-50 text-red-700 border-red-200 font-bold";
                    label = "REJECTED";
                }

                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider uppercase border ${badgeClass}`}>
                        {label}
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const v = row.original;
                const st = (v.status || "draft").toLowerCase();
                const isPendingCheck = st === "pending_check" || st === "pending" || st === "draft";
                const isPendingApproval = st === "pending_approval";
                const isApproved = st === "approved";

                return (
                    <div className="flex items-center justify-end gap-1">
                        <Link href={`/erp/finance/retail-sale-receipt-voucher/${v.id}`}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-gray-600 hover:text-blue-600"
                                title="View Details"
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                        {canUpdate && !isApproved && (
                            <Link href={`/erp/finance/retail-sale-receipt-voucher/${v.id}/edit`}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-gray-600 hover:text-amber-600"
                                    title="Edit RSRV"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-600 hover:text-blue-600"
                            onClick={() => handlePrint(v)}
                            title="Print RSRV"
                        >
                            <Printer className="h-3.5 w-3.5" />
                        </Button>
                        
                        {/* Unapprove & Unpost */}
                        {isApproved && canApprove && (
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={updatingStatusId === v.id}
                                onClick={() => handleUnapprove(v.id)}
                                className="h-7 w-7 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                title="Unapprove & Unpost RSRV"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {/* Step 1: Check / Verify */}
                        {isPendingCheck && canApprove && (
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={updatingStatusId === v.id}
                                onClick={() => handleUpdateStatus(v.id, "pending_approval")}
                                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                title="Verify / Mark Checked"
                            >
                                <FileCheck className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {/* Step 2: Final Approve */}
                        {canApprove && !isApproved && (
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={updatingStatusId === v.id}
                                onClick={() => handleUpdateStatus(v.id, "approved")}
                                className="h-7 w-7 text-green-600 hover:bg-green-50"
                                title="Approve RSRV"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {/* Reject */}
                        {canApprove && !isApproved && st !== "rejected" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600 hover:bg-red-50"
                                onClick={() => handleUpdateStatus(v.id, "rejected")}
                                title="Reject RSRV"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-4">
            <Card className="shadow-sm border border-gray-200">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600" />
                                Retail Sale Receipt Vouchers (RSRV)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Daily POS outlet reconciliation receipt vouchers & verification hierarchy
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {canCreate && (
                                <Link href="/erp/finance/retail-sale-receipt-voucher/create">
                                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                                        <Plus className="w-3.5 h-3.5" />
                                        Create RSRV
                                    </Button>
                                </Link>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="h-8 text-xs gap-1.5"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Export Excel
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                    {/* Status Tabs */}
                    <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full">
                        <TabsList className="grid grid-cols-5 w-full max-w-2xl text-xs h-9">
                            <TabsTrigger value="all" className="text-xs">
                                All ({counts.all})
                            </TabsTrigger>
                            <TabsTrigger value="pending_check" className="text-xs">
                                Pending Check ({counts.pendingCheck})
                            </TabsTrigger>
                            <TabsTrigger value="pending_approval" className="text-xs">
                                Pending Approval ({counts.pendingApproval})
                            </TabsTrigger>
                            <TabsTrigger value="approved" className="text-xs">
                                Approved ({counts.approved})
                            </TabsTrigger>
                            <TabsTrigger value="rejected" className="text-xs">
                                Rejected ({counts.rejected})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Bulk Action Bar */}
                    {selectedIds.length > 0 && (
                        <div className="flex items-center justify-between bg-blue-50 p-2.5 rounded-lg border border-blue-200 text-xs">
                            <div className="flex items-center gap-2 font-medium text-blue-900">
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                                {selectedIds.length} voucher(s) selected
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkUpdateStatus("pending_approval")}
                                    disabled={isBulkProcessing}
                                    className="h-7 text-xs bg-white text-blue-700 border-blue-300 hover:bg-blue-100"
                                >
                                    {isBulkProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileCheck className="w-3.5 h-3.5 mr-1" />}
                                    Verify Selected
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleBulkUpdateStatus("approved")}
                                    disabled={isBulkProcessing}
                                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {isBulkProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                                    Approve & Post Selected
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkUpdateStatus("rejected")}
                                    disabled={isBulkProcessing}
                                    className="h-7 text-xs bg-white text-red-600 border-red-200 hover:bg-red-50"
                                >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Reject Selected
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-600">Date Range:</span>
                            <DateRangePicker
                                from={fromDate as any}
                                to={toDate as any}
                                onSelect={(range:any) => {
                                    setFromDate(range?.from);
                                    setToDate(range?.to);
                                }}
                            />
                        </div>
                        {(fromDate || toDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                onClick={() => {
                                    setFromDate(undefined);
                                    setToDate(undefined);
                                }}
                            >
                                Clear Dates
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    <DataTable
                        columns={columns}
                        data={filteredData}
                        searchFields={[
                            { key: "rvNo", label: "RSRV No" },
                            { key: "description", label: "Description / Remarks" },
                            { key: "outlet", label: "Outlet" },
                        ]}
                        onSearchChange={(searchVal) => setSearchQuery(searchVal)}
                    />
                </CardContent>
            </Card>

            {/* Print Portal Container */}
            {mounted && printingVoucher && createPortal(
                <>
                    <style dangerouslySetInnerHTML={{ __html: `
                        @media print {
                          body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            color: black !important;
                          }
                          body > *:not(#rsrv-print-section) {
                            display: none !important;
                          }
                          #rsrv-print-section, #rsrv-print-section * {
                            visibility: visible !important;
                          }
                          #rsrv-print-section {
                            display: block !important;
                            position: relative !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            color: black !important;
                            z-index: 99999 !important;
                          }
                          tr {
                            page-break-inside: avoid;
                            break-inside: avoid;
                          }
                          thead {
                            display: table-header-group;
                          }
                          tfoot {
                            display: table-row-group;
                          }
                          @page {
                            margin: 10mm;
                            size: A4 portrait;
                          }
                        }
                    `}} />
                    <div 
                        id="rsrv-print-section" 
                        style={{
                            position: "fixed",
                            left: "-9999px",
                            top: 0,
                            pointerEvents: "none",
                        }}
                        aria-hidden="true"
                    >
                        <RetailSaleReceiptVoucherPrint voucher={printingVoucher} />
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
