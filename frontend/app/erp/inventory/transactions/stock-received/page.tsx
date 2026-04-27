import { getStockLedger } from "@/lib/actions/stock-ledger";
import { StockReceivedList } from "./stock-received-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function StockLedgerPage() {
    try {
        const result = await getStockLedger({ page: 1, limit: 50 });

        if (!result || result.status === false) {
            return (
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <h2 className="text-3xl font-bold tracking-tight">Stock Ledger</h2>
                    <ListError
                        title="Failed to load stock ledger"
                        message={result?.message || "Unable to fetch stock transactions. Please check your connection and try again."}
                    />
                </div>
            );
        }

        const data = Array.isArray(result) ? result : (result.data ?? []);
        const meta = result.meta;

        return (
            <PermissionGuard permissions="erp.inventory.stock-received.read">
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Stock Ledger</h2>
                            <p className="text-muted-foreground text-sm mt-1">
                                All stock movements — inbound, outbound, transfers, adjustments
                            </p>
                        </div>
                        {/* Visual legend */}
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                Inbound / Receiving
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                Outbound / Dispatching
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400">
                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                Transfer (paired entries share same reference)
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                Adjustment
                            </span>
                        </div>
                    </div>
                    <StockReceivedList initialEntries={data} initialMeta={meta} />
                </div>
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Stock Ledger</h2>
                <ListError
                    title="Failed to load stock ledger"
                    message={error instanceof Error ? error.message : "An unexpected error occurred."}
                />
            </div>
        );
    }
}
