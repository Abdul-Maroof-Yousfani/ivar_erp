import { EOBIWithdrawalList } from "./eobi-withdrawal-list";
import { ListError } from "@/components/dashboard/list-error";
import { getEOBIWithdrawals } from "@/lib/actions/eobi-withdrawal";

export const dynamic = "force-dynamic";

export default async function ViewEOBIWithdrawalPage() {
    try {
        const result = await getEOBIWithdrawals();
        const initialData = result.status && result.data ? result.data : [];

        return <EOBIWithdrawalList initialData={initialData} />;
    } catch (error) {
        console.error("Error in ViewEOBIWithdrawalPage:", error);
        return (
            <ListError
                title="Failed to load EOBI withdrawals"
                message={
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred. Please try again."
                }
            />
        );
    }
}
