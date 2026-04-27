import { getStockTransfers } from "@/lib/actions/stock-transfer";
import { StockTransferHistoryList } from "./transfer-history-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveryNotePage() {
    try {
        const result = await getStockTransfers();

        if (!result.status) {
            return (
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-3xl font-bold tracking-tight">Delivery Notes</h2>
                        <Button variant="outline" asChild>
                            <Link href="/erp/inventory/transactions/stock-transfer">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Transfer
                            </Link>
                        </Button>
                    </div>
                    <ListError
                        title="Failed to load delivery notes"
                        message={result?.message || "Unable to fetch transfer requests."}
                    />
                </div>
            );
        }

        const data = result.data || [];

        return (
            <PermissionGuard permissions="erp.inventory.delivery-note.read">
                <div className="flex-1 space-y-6 p-8 pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <FileText className="h-7 w-7 text-primary" />
                                <h2 className="text-3xl font-bold tracking-tight">Delivery Notes</h2>
                            </div>
                            <p className="text-muted-foreground">
                                All stock transfer records (warehouse to outlet & return transfers) and their delivery status.
                            </p>
                        </div>
                        <Button variant="outline" asChild className="border-2 font-bold shadow-sm">
                            <Link href="/erp/inventory/transactions/stock-transfer">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Transfer
                            </Link>
                        </Button>
                    </div>

                    <StockTransferHistoryList initialEntries={data} />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Delivery Notes</h2>
                </div>
                <ListError
                    title="An error occurred"
                    message={error instanceof Error ? error.message : "An unexpected error occurred."}
                />
            </div>
        );
    }
}
