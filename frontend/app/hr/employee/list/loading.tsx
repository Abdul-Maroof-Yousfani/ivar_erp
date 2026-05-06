import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Employees"
      subtitle="Manage employee records"
      actionText="Add Employee"
      rowCount={8}
      columnCount={6}
    />
  );
}
