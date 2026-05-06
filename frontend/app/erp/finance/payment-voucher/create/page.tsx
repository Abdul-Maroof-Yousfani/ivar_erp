import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { PaymentVoucherForm } from "../components/payment-voucher-form";

import { PermissionGuard } from "@/components/auth/permission-guard";

export default async function CreatePaymentVoucherPage() {


  const { data: accounts } = await getChartOfAccounts();

  return (
    <PermissionGuard permissions={["erp.finance.payment-voucher.create"]}>
      <PaymentVoucherForm accounts={accounts || []} />{" "}
    </PermissionGuard>
  );
}
