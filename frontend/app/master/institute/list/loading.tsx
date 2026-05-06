import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Institutes"
      subtitle="Manage institutes for your organization"
      actionText="Add Institute"
      rowCount={5}
      columnCount={1}
    />
  );
}

