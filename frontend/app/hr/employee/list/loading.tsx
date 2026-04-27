import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Employees"
      subtitle="Manage your organization employees"
      actionText="Add Employee"
      rowCount={5}
      columnCount={1}
    />
  );
}

