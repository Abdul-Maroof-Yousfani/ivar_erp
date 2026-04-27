import { PFWithdrawalForm } from "./pf-withdrawal-form";

export const dynamic = "force-dynamic";

export default function CreatePFWithdrawalPage() {
    return (
        <div className="container mx-auto py-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">PF Withdrawal Form</h1>
                <p className="text-muted-foreground">Create a new provident fund withdrawal request</p>
            </div>
            <PFWithdrawalForm />
        </div>
    );
}
