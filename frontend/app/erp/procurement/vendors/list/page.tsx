"use client";

import { useState, useEffect } from "react";
import { getVendors, queueSuppliersExport } from "@/lib/actions/procurement";
import { VendorList } from "../components/vendor-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { toast } from "sonner";

export default function VendorListPage() {
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const fetchVendors = async () => {
            try {
                const { data } = await getVendors();
                setVendors(data || []);
            } catch (error) {
                console.error("Failed to fetch vendors", error);
            } finally {
                setLoading(false);
            }
        };
        fetchVendors();
    }, []);

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const result = await queueSuppliersExport();
            if (result.status) {
                toast.success("Export queued — you'll get a notification when your file is ready.", {
                    duration: 6000,
                });
            } else {
                toast.error(result.message || "Failed to queue export");
            }
        } catch {
            toast.error("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <PermissionGuard permissions="erp.procurement.vendor.read">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Vendors List</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleExport}
                            disabled={isExporting || vendors.length === 0}
                            className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            {isExporting ? "Queuing…" : "Export"}
                        </Button>
                        <PermissionGuard permissions="erp.procurement.vendor.create" fallback={null}>
                            <Button variant="outline" asChild>
                                <Link href="/erp/procurement/vendors" transitionTypes={["nav-back"]}>
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Vendor Form
                                </Link>
                            </Button>
                        </PermissionGuard>
                    </div>
                </div>
                <div className="grid gap-8 grid-cols-1">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <span className="text-muted-foreground">Loading vendors...</span>
                        </div>
                    ) : (
                        <VendorList initialVendors={vendors} />
                    )}
                </div>
            </div>
        </PermissionGuard>
    );
}
