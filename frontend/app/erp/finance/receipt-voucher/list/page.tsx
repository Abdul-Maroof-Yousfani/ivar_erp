import { getReceiptVouchers } from "@/lib/actions/receipt-voucher";
import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { ReceiptVoucherList } from "../components/receipt-voucher-list";
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

export default async function ReceiptVoucherListPage() {
    const [{ data: vouchers }, { data: accounts }] = await Promise.all([
        getReceiptVouchers(),
        getChartOfAccounts(),
    ]);

    const canCreate = await hasPermission("erp.finance.receipt-voucher.create");
    const canRead = await hasPermission("erp.finance.receipt-voucher.read");
    const canUpdate = await hasPermission("erp.finance.receipt-voucher.update");
    const canDelete = await hasPermission("erp.finance.receipt-voucher.delete");
    const canApprove = await hasPermission("erp.finance.receipt-voucher.approve");

    return (
        <div className="flex-1 flex flex-col">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b">
                <div className="flex items-center gap-2 px-4">
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/erp/finance">Finance</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/erp/finance/receipt-voucher/list">Receipt Voucher</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>List</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 bg-[#F8F9FA] dark:bg-background">
                <ReceiptVoucherList
                    initialData={vouchers || []}
                    accounts={accounts || []}
                    permissions={{ canCreate, canRead, canUpdate, canDelete, canApprove }}
                />
            </div>
        </div>
    );
}
