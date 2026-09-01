import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function ReturnTransferLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ListSkeleton
        title="Return Transfer"
        subtitle="Manage stock return requests from outlets back to central warehouse"
        actionText="Return Request"
        rowCount={8}
        columnCount={6}
      />
    </div>
  );
}
