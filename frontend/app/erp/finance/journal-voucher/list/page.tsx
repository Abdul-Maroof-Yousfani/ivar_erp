import { getJournalVouchers } from "@/lib/actions/journal-voucher";
import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { JournalVoucherList } from "../components/journal-voucher-list";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { hasPermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function JournalVoucherPage() {
    const [{ data: vouchers }, { data: accounts }] = await Promise.all([
        getJournalVouchers(),
        getChartOfAccounts(),
    ]);

    const canCreate = await hasPermission("erp.finance.journal-voucher.create");
    const canRead = await hasPermission("erp.finance.journal-voucher.read");
    const canUpdate = await hasPermission("erp.finance.journal-voucher.update");
    const canDelete = await hasPermission("erp.finance.journal-voucher.delete");
    const canApprove = await hasPermission("erp.finance.journal-voucher.approve");

    return (
        <div className="flex-1 flex flex-col">
         
                <JournalVoucherList
                    initialData={vouchers || []}
                    accounts={accounts || []}
                    permissions={{ canCreate, canRead, canUpdate, canDelete, canApprove }}
                />
      
        </div>
    );
}
