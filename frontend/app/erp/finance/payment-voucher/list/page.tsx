import { getPaymentVouchers } from "@/lib/actions/payment-voucher";
import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { PaymentVoucherList } from "../components/payment-voucher-list";
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

export default async function PaymentVoucherListPage() {
  const [{ data: vouchers }, { data: accounts }] = await Promise.all([
    getPaymentVouchers(),
    getChartOfAccounts(),
  ]);

  const canCreate = await hasPermission("erp.finance.payment-voucher.create");
  const canRead = await hasPermission("erp.finance.payment-voucher.read");
  const canUpdate = await hasPermission("erp.finance.payment-voucher.update");
  const canDelete = await hasPermission("erp.finance.payment-voucher.delete");
  const canApprove = await hasPermission("erp.finance.payment-voucher.approve");

  return (
    <PaymentVoucherList
      initialData={vouchers || []}
      accounts={accounts || []}
      permissions={{ canCreate, canRead, canUpdate, canDelete, canApprove }}
    />
  );
}
