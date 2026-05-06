import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { ReceiptVoucherForm } from "../components/receipt-voucher-form";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default async function CreateReceiptVoucherPage() {

  const { data: accounts } = await getChartOfAccounts();

  return (
    <PermissionGuard permissions={["erp.finance.receipt-voucher.create"]}>
      <ReceiptVoucherForm accounts={accounts || []} />
    </PermissionGuard>
  );
}
