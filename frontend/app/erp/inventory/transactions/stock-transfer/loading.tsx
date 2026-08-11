import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function StockTransferLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ListSkeleton
        title="Stock Transfer"
        subtitle="Manage warehouse-to-outlet, outlet-to-warehouse, and outlet-to-outlet stock transfers"
        actionText="Transfer Out"
        rowCount={8}
        columnCount={6}
      />
    </div>
  );
}
