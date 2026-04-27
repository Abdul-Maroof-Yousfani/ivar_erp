import { getMaritalStatuses } from "@/lib/actions/marital-status";
import { MaritalStatusList } from "./marital-status-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function MaritalStatusListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getMaritalStatuses();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load marital statuses"
          message={result.message || "Unable to fetch marital statuses. Please check your connection and try again."}
        />
      );
    }

    return <MaritalStatusList initialMaritalStatuses={result.data || []} newItemId={newItemId} />;
  } catch (error) {
    console.error("Error in MaritalStatusListPage:", error);
    return (
      <ListError
        title="Failed to load marital statuses"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
