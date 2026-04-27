import { getWorkingHoursPolicies } from "@/lib/actions/working-hours-policy";
import { WorkingHoursPolicyList } from "./working-hours-policy-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function WorkingHoursPolicyViewPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getWorkingHoursPolicies();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load working hours policies"
          message={result.message || "Unable to fetch working hours policies. Please check your connection and try again."}
        />
      );
    }

    return (
      <WorkingHoursPolicyList
        initialPolicies={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in WorkingHoursPolicyViewPage:", error);
    return (
      <ListError
        title="Failed to load working hours policies"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

