import { getStockAdjustment } from "@/lib/actions/stock-adjustment";
import { StockAdjustmentDetail } from "./stock-adjustment-detail";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function StockAdjustmentDetailPage({ params }: PageProps) {
    const { id } = await params;

    try {
        const adjustment = await getStockAdjustment(id);

        if (!adjustment) {
            return (
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <h2 className="text-3xl font-bold tracking-tight">Stock Adjustment Detail</h2>
                    <ListError
                        title="Stock Adjustment Not Found"
                        message={`Could not find a stock adjustment with ID ${id}. It may have been deleted or the link is invalid.`}
                    />
                </div>
            );
        }

        return (
            <PermissionGuard permissions="erp.inventory.stock-ledger.read">
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <StockAdjustmentDetail adjustment={adjustment} />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Stock Adjustment Detail</h2>
                <ListError
                    title="Failed to load stock adjustment"
                    message={error instanceof Error ? error.message : "An unexpected error occurred."}
                />
            </div>
        );
    }
}
