"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { HighlightText } from "@/components/common/data-table";
import { Customer } from "@/lib/actions/customer";

export type CustomerRow = Customer & { id: string };

export const columns: ColumnDef<CustomerRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 28,
  },
  {
    header: "Code",
    accessorKey: "code",
    size: 160,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.code} />,
  },
  {
    header: "Name of Customer",
    accessorKey: "name",
    size: 240,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />,
  },
  {
    header: "Address",
    accessorKey: "address",
    size: 260,
    enableSorting: true,
    cell: ({ row }) => row.original.address || "—",
  },
  {
    header: "Contact No.",
    accessorKey: "contactNo",
    size: 180,
    enableSorting: true,
    cell: ({ row }) => row.original.contactNo || "—",
  },
];
