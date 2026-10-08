import { ReceiptVoucherForm } from "@/app/erp/finance/receipt-voucher/components/receipt-voucher-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function CreateRetailSaleReceiptVoucherPage() {
    return (
        <PermissionGuard permissions={["erp.finance.receipt-voucher.create"]}>
            <div className="flex-1 flex flex-col">
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/erp/finance">Finance</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/erp/finance/retail-sale-receipt-voucher/list">
                                    Retail Sale Receipt Voucher
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Create Manual RSRV</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <div className="p-4 md:p-6 bg-gray-50 flex-1">
                    <ReceiptVoucherForm defaultType="rs_rv" />
                </div>
            </div>
        </PermissionGuard>
    );
}
