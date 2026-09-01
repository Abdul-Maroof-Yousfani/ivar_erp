import { ReceiptVoucherForm } from "../components/receipt-voucher-form";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default async function CreateReceiptVoucherPage() {
  return (
    <PermissionGuard permissions={["erp.finance.receipt-voucher.create"]}>
      <ReceiptVoucherForm />
    </PermissionGuard>
  );
}
