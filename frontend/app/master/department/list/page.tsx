import { getDepartments } from "@/lib/actions/department";
import { DepartmentList } from "./department-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function DepartmentListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {

  try {
    const { newItemId } = await searchParams;
    const result = await getDepartments();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load departments"
          message={result.message || "Unable to fetch departments. Please check your connection and try again."}
        />
      );
    }

    return (
      <PermissionGuard permissions={["master.department.read", "master.department.create", "master.department.update", "master.department.delete"]}>
        <DepartmentList
          initialDepartments={result.data || []}
          newItemId={newItemId}
        />
      </PermissionGuard>
    );
  } catch (error) {
    return (
      <ListError
        title="Failed to load departments"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
