"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteTaxRate, type TaxRate } from "@/lib/actions/tax-rate";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type TaxRateRow = Pick<TaxRate, "id" | "taxRate1">;

export const columns: ColumnDef<TaxRateRow>[] = [
  {
    id: "sn",
    header: () => <div className="text-center">S.No</div>,
    cell: ({ row, table }) => (
      <div className="text-center">
        {table.getSortedRowModel().flatRows.indexOf(row) + 1}
      </div>
    ),
    size: 60,
  },
  { accessorKey: "taxRate1", header: "Tax Rate 1" },
  {
    id: "actions",
    header: () => <div className="text-center">Action</div>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 100,
  },
];

function RowActions({ row }: { row: any }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const id = row.original.id as string;

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTaxRate(id);
      if (res.status) {
        toast.success("Deleted successfully");
        router.refresh();
      } else {
        toast.error(res.message || "Failed to delete");
      }
    });
  };

  return (
    <div className="flex justify-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={isPending}
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
