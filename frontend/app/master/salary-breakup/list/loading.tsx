import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Salary Breakup"
      subtitle="Manage your organization salary breakup configurations"
      actionText="Add Salary Breakup"
      rowCount={5}
      columnCount={4}
    />
  );
}

