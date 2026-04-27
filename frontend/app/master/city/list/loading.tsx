import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function Loading() {
  return (
    <ListSkeleton
      title="Cities"
      subtitle="Manage cities with coordinates"
      actionText="Add City"
      rowCount={5}
      columnCount={4}
    />
  );
}

