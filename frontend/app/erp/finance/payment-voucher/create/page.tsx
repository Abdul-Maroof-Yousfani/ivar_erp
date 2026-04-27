import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { PaymentVoucherForm } from "../components/payment-voucher-form";
import { hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CreatePaymentVoucherPage() {
  const canCreate = await hasPermission("erp.finance.payment-voucher.create");
  if (!canCreate) redirect("/erp/finance/payment-voucher/list");

  const { data: accounts } = await getChartOfAccounts();

  return <PaymentVoucherForm accounts={accounts || []} />;
}
