import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Marital Status"
      subtitle="Manage your organization marital status"
      actionText="Add Marital Status"
      rowCount={5}
      columnCount={2}
    />
  );
}

