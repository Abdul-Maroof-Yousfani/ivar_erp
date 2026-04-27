import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getLoanTypes } from "@/lib/actions/loan-type";
import { CreateLoanRequestClient } from "./create-loan-request-client";

export default async function CreateLoanRequestPage() {
  // Fetch initial data on server
  const [deptResult, empResult, loanTypesResult] = await Promise.all([
    getDepartments(),
    getEmployeesForDropdown(),
    getLoanTypes(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const employees = empResult.status && empResult.data ? empResult.data : [];
  const loanTypes =
    loanTypesResult.status && loanTypesResult.data
      ? loanTypesResult.data.filter((lt) => lt.status === "active")
      : [];

  return (
    <CreateLoanRequestClient
      initialDepartments={departments}
      initialEmployees={employees}
      initialLoanTypes={loanTypes}
    />
  );
}

