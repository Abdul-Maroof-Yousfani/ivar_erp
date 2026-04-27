import { BankReportList } from "./bank-report-list";
import { ListError } from "@/components/dashboard/list-error";
import { getAllowances } from "@/lib/actions/allowance";
import { getBanks } from "@/lib/actions/bank";

export const dynamic = "force-dynamic";

export default async function BankReportPage() {
  try {
    const [allowanceResult, banksResult] = await Promise.all([
      getAllowances(),
      getBanks(),
    ]);
    
    const allowances = allowanceResult.status && allowanceResult.data ? allowanceResult.data : [];
    const banks = banksResult.status && banksResult.data ? banksResult.data : [];

    return <BankReportList initialAllowances={allowances} banks={banks} />;
  } catch (error) {
    console.error("Error in BankReportPage:", error);
    return (
      <ListError
        title="Failed to load bank report"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

