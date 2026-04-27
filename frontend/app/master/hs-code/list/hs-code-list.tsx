"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, HsCodeRow } from "./columns";
import { HsCode, deleteHsCode } from "@/lib/actions/hs-code";
import { toast } from "sonner";
import { HsCodeBulkUploadModal } from "@/components/master/hscode-bulk-upload-modal";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface HsCodeListProps {
    initialHsCodes: HsCode[];
    newItemId?: string;
}

export function HsCodeList({ initialHsCodes, newItemId }: HsCodeListProps) {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const [isPending, startTransition] = useTransition();
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [uploadId, setUploadId] = useState<string | null>(null);

    const handleToggle = () => {
        startTransition(() => {
            addTransitionType("nav-forward");
            router.push("/master/hs-code/add");
        });
    };

    const showAddAction = hasPermission("master.hs-code.create");
    const canBulkDelete = hasPermission("master.hs-code.delete");
    const canBulkUpload = hasPermission("master.hs-code.create"); // Assuming same permission for bulk upload

    const handleMultiDelete = (ids: string[]) => {
        // Implementing simple delete for each since I don't have bulk delete for HS Code yet
        startTransition(async () => {
            for (const id of ids) {
                await deleteHsCode(id);
            }
            toast.success("Items deleted successfully");
            router.refresh();
        });
    };

    const handleBulkUploadSuccess = () => {
        toast.success("HS Codes imported successfully!");
        router.refresh();
        setIsBulkUploadOpen(false);
    };

    // Transform data to ensure string id
    const data: HsCodeRow[] = initialHsCodes.map((item) => ({
        ...item,
        id: item.id.toString(),
    }));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">HS Codes</h2>
                    <p className="text-muted-foreground">
                        Manage Harmonized System Codes and tax percentages
                    </p>
                </div>
                
                {canBulkUpload && (
                    <Button
                        onClick={() => setIsBulkUploadOpen(true)}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        Bulk Upload
                    </Button>
                )}
            </div>

            <DataTable<HsCodeRow>
                columns={columns}
                data={data}
                actionText={showAddAction ? "Add HS Code" : undefined}
                toggleAction={showAddAction ? handleToggle : undefined}
                newItemId={newItemId}
                searchFields={[{ key: "hsCode", label: "HS Code" }]}
                onMultiDelete={canBulkDelete ? handleMultiDelete : undefined}
                tableId="hs-code-list"
            />

            <HsCodeBulkUploadModal
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                onSuccess={handleBulkUploadSuccess}
                uploadId={uploadId}
                onUploadIdChange={setUploadId}
            />
        </div>
    );
}
