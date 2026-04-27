import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Designations"
      subtitle="Manage your organization designations"
      actionText="Add Designation"
      rowCount={5}
      columnCount={3}
    />
  );
}

