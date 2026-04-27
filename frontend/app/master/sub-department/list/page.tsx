import { getDepartments, getSubDepartments } from "@/lib/actions/department";
import { SubDepartmentList } from "./sub-department-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function SubDepartmentListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const [subDeptRes, deptRes] = await Promise.all([
      getSubDepartments(),
      getDepartments(),
    ]);

    if (!subDeptRes.status || !subDeptRes.data) {
      return (
        <ListError
          title="Failed to load sub-departments"
          message={subDeptRes.message || "Unable to fetch sub-departments. Please check your connection and try again."}
        />
      );
    }

    if (!deptRes.status || !deptRes.data) {
      return (
        <ListError
          title="Failed to load departments"
          message={deptRes.message || "Unable to fetch departments. Please check your connection and try again."}
        />
      );
    }

    return (
      <SubDepartmentList
        initialSubDepartments={subDeptRes.data || []}
        departments={deptRes.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in SubDepartmentListPage:", error);
    return (
      <ListError
        title="Failed to load sub-departments"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}
