import { CreateJournalVoucherClient } from "./create-journal-voucher-client";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default async function CreateJournalVoucherPage() {
    return (
        <PermissionGuard permissions={["erp.finance.journal-voucher.create"]}>
            <div className="flex-1 flex flex-col">
                <CreateJournalVoucherClient />
            </div>
        </PermissionGuard>
    );
}
