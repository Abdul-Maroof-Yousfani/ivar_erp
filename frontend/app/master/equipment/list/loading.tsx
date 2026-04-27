import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Equipment"
      subtitle="Manage your organization equipment"
      actionText="Add Equipment"
      rowCount={5}
      columnCount={3}
    />
  );
}

