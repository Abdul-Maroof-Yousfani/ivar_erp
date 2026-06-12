"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getReceiptVoucher, type ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { ReceiptVoucherForm } from "../../components/receipt-voucher-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function EditReceiptVoucherPage({
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
        if (res.data.status !== "pending") {
          toast.error("Voucher can only be edited when status is pending");
          router.push(`/erp/finance/receipt-voucher/${id}`);
        } else {
          setVoucher(res.data);
        }
      } else {
        toast.error(res.message || "Failed to load receipt voucher");
      }
      setLoading(false);
    });
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin opacity-40" />
          <span className="text-sm">Loading receipt voucher…</span>
        </div>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-red-500 font-medium">Receipt Voucher not found or cannot be edited.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/erp/finance/receipt-voucher/list">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/erp/finance/receipt-voucher/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Details
          </Link>
        </Button>
      </div>
      <ReceiptVoucherForm initialData={voucher} />
    </div>
  );
}
