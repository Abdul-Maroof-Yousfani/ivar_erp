import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Branches"
      subtitle="Manage your organization branches"
      actionText="Add Branch"
      rowCount={5}
      columnCount={4}
    />
  );
}

