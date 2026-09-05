"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getReceiptVoucher, type ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { ReceiptVoucherForm } from "@/app/erp/finance/receipt-voucher/components/receipt-voucher-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function EditRetailSaleReceiptVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [voucher, setVoucher] = useState<ReceiptVoucher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReceiptVoucher(id).then((res) => {
      if (res.status && res.data) {
        setVoucher(res.data);
      } else {
        toast.error(res.message || "Failed to load Retail Sale Receipt Voucher");
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin opacity-40" />
          <span className="text-sm">Loading Retail Sale Receipt Voucher…</span>
        </div>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-red-500 font-medium">Retail Sale Receipt Voucher not found or cannot be edited.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/erp/finance/retail-sale-receipt-voucher/list">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to RSRV List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-4">
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
              <BreadcrumbPage>Edit {voucher.rvNo}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/erp/finance/retail-sale-receipt-voucher/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Details
            </Link>
          </Button>
        </div>
        <ReceiptVoucherForm initialData={voucher} defaultType="rs_rv" />
      </div>
    </div>
  );
}
