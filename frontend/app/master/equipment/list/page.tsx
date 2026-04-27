import { getEquipments } from "@/lib/actions/equipment";
import { EquipmentList } from "./equipment-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function EquipmentListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getEquipments();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load equipment"
          message={result.message || "Unable to fetch equipment. Please check your connection and try again."}
        />
      );
    }

    return <EquipmentList initialEquipments={result.data || []} newItemId={newItemId} />;
  } catch (error) {
    console.error("Error in EquipmentListPage:", error);
    return (
      <ListError
        title="Failed to load equipment"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

