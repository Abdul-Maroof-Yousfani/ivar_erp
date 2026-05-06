import { getQualifications } from "@/lib/actions/qualification";
import { QualificationList } from "./qualification-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function QualificationListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getQualifications();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load qualifications"
          message={result.message || "Unable to fetch qualifications. Please check your connection and try again."}
        />
      );
    }

    return (
      <QualificationList
        initialQualifications={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in QualificationListPage:", error);
    return (
      <ListError
        title="Failed to load qualifications"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
