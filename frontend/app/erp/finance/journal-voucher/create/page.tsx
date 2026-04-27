import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { CreateJournalVoucherClient } from "./create-journal-voucher-client";
import { hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CreateJournalVoucherPage() {
    const canCreate = await hasPermission("erp.finance.journal-voucher.create");
    if (!canCreate) redirect("/erp/finance/journal-voucher/list");

    const { data: accounts } = await getChartOfAccounts();

    return (
        <div className="flex-1 flex flex-col">
            <CreateJournalVoucherClient accounts={accounts || []} />
        </div>
    );
}
