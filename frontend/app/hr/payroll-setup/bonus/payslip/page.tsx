import { BonusPayslipList } from "./bonus-payslip-list";
import { ListError } from "@/components/dashboard/list-error";
import { getBonuses } from "@/lib/actions/bonus";

export const dynamic = "force-dynamic";

export default async function BonusPayslipPage() {
  try {
    const bonusResult = await getBonuses();
    const bonuses = bonusResult.status && bonusResult.data ? bonusResult.data : [];

    return <BonusPayslipList initialBonuses={bonuses} />;
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

