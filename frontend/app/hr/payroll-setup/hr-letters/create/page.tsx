import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getDepartments } from "@/lib/actions/department";
import { getHrLetterTypes } from "@/lib/actions/hr-letter";
import { CreateHrLetterClient } from "./create-hr-letter-client";

export default async function CreateHrLetterPage() {
  // Fetch initial data on server
  const [deptResult, empResult, letterTypesResult] = await Promise.all([
    getDepartments(),
    getEmployeesForDropdown(),
    getHrLetterTypes(),
  ]);

  const departments = deptResult.status && deptResult.data ? deptResult.data : [];
  const employees = empResult.status && empResult.data ? empResult.data : [];
  const letterTypes =
    letterTypesResult.status && letterTypesResult.data
      ? letterTypesResult.data.filter((lt) => lt.status === "active")
      : [];

  return (
    <CreateHrLetterClient
      initialDepartments={departments}
      initialEmployees={employees}
      initialLetterTypes={letterTypes}
    />
  );
}

