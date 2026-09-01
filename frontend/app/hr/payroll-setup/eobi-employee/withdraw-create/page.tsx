import { EOBIWithdrawalForm } from "./eobi-withdrawal-form";

export const dynamic = "force-dynamic";

export default function CreateEOBIWithdrawalPage() {
    return (
        <div className="container mx-auto py-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">EOBI Withdrawal Form</h1>
                <p className="text-muted-foreground">Create a new EOBI withdrawal request</p>
            </div>
            <EOBIWithdrawalForm />
        </div>
    );
}
