import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Qualifications"
      subtitle="Manage qualifications for your organization"
      actionText="Add Qualification"
      rowCount={5}
      columnCount={1}
    />
  );
}

