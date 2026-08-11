import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function TransactionsLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ListSkeleton
        title="Inventory Transactions"
        subtitle="Manage and view stock movements, transfers, adjustments, and delivery notes"
        actionText="New Transaction"
        rowCount={8}
        columnCount={6}
      />
    </div>
  );
}
