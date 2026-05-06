import { Suspense } from "react";
import { BankReportContent } from "./bank-report-content";
import { getBanks } from "@/lib/actions/bank";

export const metadata = {
    title: "Bank Report | HRM",
    description: "Generate bank salary transfer authorization letter",
};

export default async function BankReportPage() {
    const result = await getBanks();
    const banks = result.status ? result.data : [];

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BankReportContent initialBanks={banks} />
        </Suspense>
    );
}
