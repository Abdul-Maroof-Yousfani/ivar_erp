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
  type: "LOCAL" | "IMPORT" | "INTERNATIONAL";
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
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded bg-muted/70 text-foreground">
        {row.original.code}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.name}</span>
    ),
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
    accessorKey: "nature",
    header: "Nature",
    cell: ({ row }) => {
      const nature = row.original.nature;
      if (!nature) return <span className="text-muted-foreground">-</span>;
      const upper = nature.toUpperCase();
      let colorClass = "bg-muted text-muted-foreground border-transparent";
      if (upper === "FABRIC") {
        colorClass = "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
      } else if (upper === "GOODS") {
        colorClass = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      } else if (upper === "SERVICES" || upper.includes("CMT")) {
        colorClass = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      } else if (upper === "ACCESSORIES") {
        colorClass = "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20";
      }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
          {nature}
        </span>
      );
    },
  },
  {
    accessorKey: "contactNo",
    header: "Contact",
    cell: ({ row }) => row.original.contactNo || "-",
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
              <Link href={`/erp/procurement/vendors/view/${vendor.id}`} transitionTypes={["nav-forward"]}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            {hasPermission("erp.procurement.vendor.update") && (
              <DropdownMenuItem asChild>
                <Link href={`/erp/procurement/vendors/edit/${vendor.id}`} transitionTypes={["nav-forward"]}>
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
