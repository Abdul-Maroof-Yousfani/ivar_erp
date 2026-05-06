import { getEmployeeGrades } from "@/lib/actions/employee-grade";
import { EmployeeGradeList } from "./employee-grade-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function EmployeeGradeListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getEmployeeGrades();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load employee grades"
          message={result.message || "Unable to fetch employee grades. Please check your connection and try again."}
        />
      );
    }

    return (
      <PermissionGuard permissions="employee-grade.read">
        <EmployeeGradeList
          initialEmployeeGrades={result.data || []}
          newItemId={newItemId}
        />
      </PermissionGuard>
    );
  } catch (error) {
    console.error("Error in EmployeeGradeListPage:", error);
    return (
      <ListError
        title="Failed to load employee grades"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

