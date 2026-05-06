import { getDesignations } from "@/lib/actions/designation";
import { DesignationList } from "./designation-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function DesignationListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getDesignations();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load designations"
          message={result.message || "Unable to fetch designations. Please check your connection and try again."}
        />
      );
    }

    return (
      <PermissionGuard permissions="designation.read">
        <DesignationList
          initialDesignations={result.data || []}
          newItemId={newItemId}
        />
      </PermissionGuard>
    );
  } catch (error) {
    console.error("Error in DesignationListPage:", error);
    return (
      <ListError
        title="Failed to load designations"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
