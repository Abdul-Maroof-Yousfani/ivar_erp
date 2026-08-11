import { ListSkeleton } from "@/components/dashboard/list-skeleton";

export default function DeliveryNoteLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ListSkeleton
        title="Delivery Notes"
        subtitle="List of generated delivery challans and dispatch notes"
        actionText="Delivery Note"
        rowCount={8}
        columnCount={6}
      />
    </div>
  );
}
