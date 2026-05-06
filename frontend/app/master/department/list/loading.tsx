import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Departments"
      subtitle="Manage your organization departments"
      actionText="Add Department"
      rowCount={5}
      columnCount={1}
    />
  );
}

