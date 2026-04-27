import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Leave Types"
      subtitle="Manage your organization leave types"
      actionText="Add Leave Type"
      rowCount={5}
      columnCount={3}
    />
  );
}

