import { PFWithdrawalList } from "./pf-withdrawal-list";
import { ListError } from "@/components/dashboard/list-error";
import { getPFWithdrawals } from "@/lib/actions/pf-withdrawal";

export const dynamic = "force-dynamic";

export default async function ViewPFWithdrawalPage() {
    try {
        const result = await getPFWithdrawals();
        const initialData = result.status && result.data ? result.data : [];

        return <PFWithdrawalList initialData={initialData} />;
    } catch (error) {
        console.error("Error in ViewPFWithdrawalPage:", error);
        return (
            <ListError
                title="Failed to load PF withdrawals"
                message={
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred. Please try again."
                }
            />
        );
    }
}
