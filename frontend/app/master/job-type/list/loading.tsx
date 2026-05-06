import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Job Types"
      subtitle="Manage your organization job types"
      actionText="Add Job Type"
      rowCount={5}
      columnCount={2}
    />
  );
}

