import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function StockAdjustmentLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ListSkeleton
        title="Stock Adjustments"
        subtitle="Correct differences between physical stock count and system records"
        actionText="New Adjustment"
        rowCount={8}
        columnCount={6}
      />
    </div>
  );
}
