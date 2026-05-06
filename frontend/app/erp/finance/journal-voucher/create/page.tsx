import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { CreateJournalVoucherClient } from "./create-journal-voucher-client";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default async function CreateJournalVoucherPage() {
 
    const { data: accounts } = await getChartOfAccounts();

    return (
        <PermissionGuard permissions={["erp.finance.journal-voucher.create"]}>
        <div className="flex-1 flex flex-col">
            <CreateJournalVoucherClient accounts={accounts || []} />
        </div>
        </PermissionGuard>
    );
}
