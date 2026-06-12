import { getStockAdjustments } from "@/lib/actions/stock-adjustment";
import { StockAdjustmentList } from "./stock-adjustment-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function StockAdjustmentPage() {
    try {
        const result = await getStockAdjustments({ page: 1, limit: 50 });

        if (!result || result.status === false) {
            return (
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <h2 className="text-3xl font-bold tracking-tight">Stock Adjustments</h2>
                    <ListError
                        title="Failed to load stock adjustments"
                        message={result?.message || "Unable to fetch stock adjustments. Please check your connection and try again."}
                    />
                </div>
            );
        }

        const data = result.data ?? [];
        const meta = result.meta;

        return (
            <PermissionGuard permissions="erp.inventory.stock-ledger.read">
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-3xl font-bold tracking-tight">Stock Adjustments</h2>
                        <p className="text-muted-foreground text-sm">
                            Correct differences between physical stock count and system records
                        </p>
                    </div>
                    <StockAdjustmentList initialEntries={data} initialMeta={meta} />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Stock Adjustments</h2>
                <ListError
                    title="Failed to load stock adjustments"
                    message={error instanceof Error ? error.message : "An unexpected error occurred."}
                />
            </div>
        );
    }
}
