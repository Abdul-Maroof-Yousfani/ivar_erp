import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function StockLedgerLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ListSkeleton
        title="Stock Ledger"
        subtitle="All stock movements — inbound, outbound, transfers, adjustments"
        actionText="Stock Movement"
        rowCount={10}
        columnCount={7}
      />
    </div>
  );
}
