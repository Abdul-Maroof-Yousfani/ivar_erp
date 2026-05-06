import { getJobTypes } from "@/lib/actions/job-type";
import { JobTypeList } from "./job-type-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function JobTypeListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getJobTypes();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load job types"
          message={result.message || "Unable to fetch job types. Please check your connection and try again."}
        />
      );
    }

    return <JobTypeList initialJobTypes={result.data || []} newItemId={newItemId} />;
  } catch (error) {
    console.error("Error in JobTypeListPage:", error);
    return (
      <ListError
        title="Failed to load job types"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
