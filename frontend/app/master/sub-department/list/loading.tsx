import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Sub-Departments"
      subtitle="Manage your organization sub-departments"
      actionText="Add Sub-Department"
      rowCount={5}
      columnCount={2}
    />
  );
}

