"use client";

import { JournalVoucherForm } from "../components/journal-voucher-form";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";

export function CreateJournalVoucherClient({ accounts }: { accounts: ChartOfAccount[] }) {
    return (
        <div className="flex flex-1 flex-col">
            <JournalVoucherForm accounts={accounts} />
        </div>
    );
}
