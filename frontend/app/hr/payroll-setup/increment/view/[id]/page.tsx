import { getIncrementById } from "@/lib/actions/increment";
import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getEmployeeGrades } from "@/lib/actions/employee-grade";
import { getDesignations } from "@/lib/actions/designation";
import { CreateIncrementClient } from "../../create/create-increment-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function ViewIncrementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  if (!id) {
    notFound();
  }
  
  // Fetch increment data and initial data
  // Individually handle catches to ensure one failure doesn't block the rest
  const [incrementResult, deptResult, empResult, gradesResult, designationsResult] = await Promise.all([
    getIncrementById(id).catch(err => ({ status: false, data: null, message: err.message })),
    getDepartments().catch(() => ({ status: false, data: [] })),
    getEmployeesForDropdown().catch(() => ({ status: false, data: [] })),
    getEmployeeGrades().catch(() => ({ status: false, data: [] })),
    getDesignations().catch(() => ({ status: false, data: [] })),
  ]);

  if (!incrementResult.status || !incrementResult.data) {
    notFound();
  }

  const increment = incrementResult.data;
  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const employees = empResult.status && empResult.data ? empResult.data : [];
  const employeeGrades =
    gradesResult.status && gradesResult.data
      ? gradesResult.data.filter((g) => g.status === "active")
      : [];
  const designations =
    designationsResult.status && designationsResult.data
      ? designationsResult.data.filter((d) => d.status === "active")
      : [];

  return (
    <CreateIncrementClient
      initialDepartments={departments}
      initialEmployees={employees}
      initialEmployeeGrades={employeeGrades}
      initialDesignations={designations}
      viewMode={true}
      initialIncrement={increment}
    />
  );
}

