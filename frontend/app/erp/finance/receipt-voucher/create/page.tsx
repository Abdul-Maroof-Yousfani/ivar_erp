import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { ReceiptVoucherForm } from "../components/receipt-voucher-form";
import { hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CreateReceiptVoucherPage() {
    const canCreate = await hasPermission("erp.finance.receipt-voucher.create");
    if (!canCreate) redirect("/erp/finance/receipt-voucher/list");

    const { data: accounts } = await getChartOfAccounts();

    return <ReceiptVoucherForm accounts={accounts || []} />;
}
