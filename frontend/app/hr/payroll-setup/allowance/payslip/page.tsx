import { AllowancePayslipList } from "./allowance-payslip-list";
import { ListError } from "@/components/dashboard/list-error";
import { getAllowances } from "@/lib/actions/allowance";
import { getEmployeesForDropdown } from "@/lib/actions/employee";

export const dynamic = "force-dynamic";

export default async function AllowancePayslipPage() {
  try {
    const [allowanceResult, employeesResult] = await Promise.all([
      getAllowances(),
      getEmployeesForDropdown(),
    ]);
    
    const allowances = allowanceResult.status && allowanceResult.data ? allowanceResult.data : [];
    const employees = employeesResult.status && employeesResult.data ? employeesResult.data : [];

    return <AllowancePayslipList initialAllowances={allowances} employees={employees} />;
  } catch (error) {
    console.error("Error in AllowancePayslipPage:", error);
    return (
      <ListError
        title="Failed to load allowance payslip"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

