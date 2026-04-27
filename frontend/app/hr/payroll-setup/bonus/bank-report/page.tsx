import { BankReportList } from "./bank-report-list";
import { ListError } from "@/components/dashboard/list-error";
import { getBonuses } from "@/lib/actions/bonus";
import { getBanks } from "@/lib/actions/bank";

export const dynamic = "force-dynamic";

export default async function BankReportPage() {
  try {
    const [bonusResult, banksResult] = await Promise.all([
      getBonuses(),
      getBanks(),
    ]);
    
    const bonuses = bonusResult.status && bonusResult.data ? bonusResult.data : [];
    const banks = banksResult.status && banksResult.data ? banksResult.data : [];

    return <BankReportList initialBonuses={bonuses} banks={banks} />;
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

