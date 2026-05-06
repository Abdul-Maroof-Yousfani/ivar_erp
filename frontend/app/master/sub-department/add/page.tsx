import { getDepartments } from "@/lib/actions/department";
import { SubDepartmentAddForm } from "./sub-department-add-form";

export const dynamic = "force-dynamic";

export default async function AddSubDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string }>;
}) {
  const { departmentId } = await searchParams;
  const { data: departments } = await getDepartments();

  return (
    <SubDepartmentAddForm
      departments={departments || []}
      defaultDepartmentId={departmentId}
    />
  );
}
