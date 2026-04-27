"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";

export type VendorRow = {
  id: string;
  code: string;
  name: string;
  type: "LOCAL" | "INTERNATIONAL";
  contactNo?: string;
  address?: string;
  nature?: string;
  brand?: string;
  chartOfAccounts?: {
    code: string;
    name: string;
  }[];
};

export const columns: ColumnDef<VendorRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant={row.original.type === "LOCAL" ? "default" : "secondary"}>
        {row.original.type === "LOCAL" ? "Local" : "Import"}
      </Badge>
    ),
  },
  {
    accessorKey: "contactNo",
    header: "Contact Number",
  },
  {
    accessorKey: "nature",
    header: "Nature",
    cell: ({ row }) => row.original.nature || "-",
  },
  {
    accessorKey: "brand",
    header: "Brand",
    cell: ({ row }) => row.original.brand || "-",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const vendor = row.original;
      const { hasPermission } = useAuth();

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/erp/procurement/vendors/view/${vendor.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            {hasPermission("erp.procurement.vendor.update") && (
              <DropdownMenuItem asChild>
                <Link href={`/erp/procurement/vendors/edit/${vendor.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
