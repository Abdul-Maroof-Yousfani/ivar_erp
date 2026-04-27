"use client";

import { useState, useEffect } from "react";
import { getVendors } from "@/lib/actions/procurement";
import { VendorList } from "../components/vendor-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function VendorListPage() {
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <PermissionGuard permissions="erp.procurement.vendor.read">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Vendors List</h2>
                    <PermissionGuard permissions="erp.procurement.vendor.create" fallback={null}>
                        <Button variant="outline" asChild>
                            <Link href="/erp/procurement/vendors" transitionTypes={["nav-back"]}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Vendor Form
                            </Link>
                        </Button>
                    </PermissionGuard>
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
