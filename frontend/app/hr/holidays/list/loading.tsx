import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Holidays"
      subtitle="Manage your organization holiday configurations"
      actionText="Add Holiday"
      rowCount={5}
      columnCount={4}
    />
  );
}

