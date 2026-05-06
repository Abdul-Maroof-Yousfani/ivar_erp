import { BonusPayslipList } from "./bonus-payslip-list";
import { ListError } from "@/components/dashboard/list-error";
import { getBonuses } from "@/lib/actions/bonus";
import { getEmployeesForDropdown } from "@/lib/actions/employee";

export const dynamic = "force-dynamic";

export default async function BonusPayslipPage() {
  try {
    const [bonusResult, employeesResult] = await Promise.all([
      getBonuses(),
      getEmployeesForDropdown(),
    ]);
    
    const bonuses = bonusResult.status && bonusResult.data ? bonusResult.data : [];
    const employees = employeesResult.status && employeesResult.data ? employeesResult.data : [];

    return <BonusPayslipList initialBonuses={bonuses} employees={employees} />;
  } catch (error) {
    console.error("Error in BonusPayslipPage:", error);
    return (
      <ListError
        title="Failed to load bonus payslip"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

