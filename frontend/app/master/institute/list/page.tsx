import { getInstitutes } from "@/lib/actions/institute";
import { InstituteList } from "./institute-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function InstituteListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getInstitutes();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load institutes"
          message={result.message || "Unable to fetch institutes. Please check your connection and try again."}
        />
      );
    }

    return (
      <InstituteList
        initialInstitutes={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in InstituteListPage:", error);
    return (
      <ListError
        title="Failed to load institutes"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

