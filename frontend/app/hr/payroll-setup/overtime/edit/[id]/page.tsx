import { getOvertimeRequestById } from "@/lib/actions/overtime";
import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { EditOvertimeClient } from "./edit-overtime-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditOvertimePage({ params }: PageProps) {
  const { id } = await params;
  // Fetch overtime request, employees, and departments in parallel
  const [overtimeResult, empResult, deptResult] = await Promise.all([
    getOvertimeRequestById(id),
    getEmployeesForDropdown(),
    getDepartments(),
  ]);

  if (!overtimeResult.status || !overtimeResult.data) {
    notFound();
  }

  const employees = empResult.status && empResult.data ? empResult.data : [];
  const departments = deptResult.status && deptResult.data ? deptResult.data : [];

  return (
    <EditOvertimeClient
      initialData={overtimeResult.data}
      initialEmployees={employees}
      initialDepartments={departments}
    />
  );
}

