"use client";

import { useState, useEffect } from "react";
import { getVendor } from "@/lib/actions/procurement";
import { VendorForm } from "../../components/vendor-form";
import { notFound, useParams } from "next/navigation";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function EditVendorPage() {
    const params = useParams();
    const id = params.id as string;
    const [vendor, setVendor] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVendor = async () => {
            try {
                const { data } = await getVendor(id);
                setVendor(data);
            } catch (error) {
                console.error("Failed to fetch vendor", error);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchVendor();
    }, [id]);

    if (!loading && !vendor) {
        notFound();
    }

    return (
        <PermissionGuard permissions="erp.procurement.vendor.update">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Edit Vendor</h2>
                </div>
                <div className="grid gap-4 grid-cols-1">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <span className="text-muted-foreground">Loading vendor details...</span>
                        </div>
                    ) : (
                        <VendorForm initialData={vendor} id={id} />
                    )}
                </div>
            </div>
        </PermissionGuard>
    );
}
