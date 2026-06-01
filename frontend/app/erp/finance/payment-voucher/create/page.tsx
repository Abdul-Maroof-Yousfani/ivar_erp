import { PaymentVoucherForm } from "../components/payment-voucher-form";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default async function CreatePaymentVoucherPage() {
  return (
    <PermissionGuard permissions={["erp.finance.payment-voucher.create"]}>
      <PaymentVoucherForm />
    </PermissionGuard>
  );
}
