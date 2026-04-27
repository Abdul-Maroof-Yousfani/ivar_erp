"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ChevronRight, Folder, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteChartOfAccount } from "@/lib/actions/chart-of-account";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const columns: ColumnDef<ChartOfAccount>[] = [
  {
    accessorKey: "name",
    header: "Name",
    filterFn: (row, id, value) => {
      const name = row.original.name?.toLowerCase() || "";
      const code = row.original.code?.toLowerCase() || "";
      const search = value.toLowerCase();
      return name.includes(search) || code.includes(search);
    },
    cell: ({ row }) => {
      const isGroup = row.original.isGroup;
      const indentSize = 24;
      
      return (
        <div className="flex items-center h-full w-full py-2 pr-4 relative group">
          {/* Vertical Lines - Guide lines for tree structure */}
          {Array.from({ length: row.depth }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-border/40"
              style={{ left: `${i * indentSize + 12}px` }}
            />
          ))}
          
          <div 
            className="flex items-center" 
            style={{ paddingLeft: `${row.depth * indentSize}px` }}
          >
            {/* Connection line for current level (L-shape simulation) */}
            {row.depth > 0 && (
                <div 
                    className="absolute w-3 h-px bg-border/40" 
                    style={{ left: `${(row.depth - 1) * indentSize + 12}px` }}
                />
            )}

            {row.getCanExpand() ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  row.toggleExpanded();
                }}
                className={cn(
                  "mr-1 p-0.5 rounded-sm hover:bg-muted transition-transform duration-200 z-10",
                  row.getIsExpanded() && "rotate-90"
                )}
              >
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
               <span className="w-5 mr-1" />
            )}

            {isGroup ? (
              <Folder className="mr-2 h-4 w-4 shrink-0 text-blue-500 fill-blue-500/20" />
            ) : (
              <FileText className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            )}
            
            <div className="flex flex-col">
                 <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground/70">
                        {row.original.code}
                    </span>
                    <span className={cn(
                        "truncate transition-colors",
                        isGroup ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}>
                        {row.getValue("name")}
                    </span>
                 </div>
             </div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <Badge variant="outline" className="font-normal">{row.getValue("type")}</Badge>,
  },
  {
    accessorKey: "isGroup",
    header: "Group",
    cell: ({ row }) => (
      <Checkbox checked={row.getValue("isGroup")} disabled className="opacity-70" />
    ),
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isActive") ? "default" : "secondary"} className="rounded-full">
        {row.getValue("isActive") ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("balance"));
      const formatted = new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
      }).format(amount);
      return <div className="text-right font-medium font-mono">{formatted.replace('PKR', 'Rs.')}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const account = row.original;
      const permissions = (table.options.meta as any)?.permissions;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(account.id);
                  toast.success("ID copied to clipboard");
                } else {
                  toast.error("Clipboard access not available");
                }
              }}
            >
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {permissions?.canUpdate && (
              <Link href={`/erp/finance/chart-of-accounts/edit/${account.id}`}>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
              </Link>
            )}
            {permissions?.canDelete && (
              <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  onClick={async () => {
                      if (confirm("Are you sure you want to delete this account?")) {
                          const res = await deleteChartOfAccount(account.id);
                          if (res.status) {
                              toast.success(res.message);
                          } else {
                              toast.error(res.message);
                          }
                      }
                  }}
              >
                Delete
              </DropdownMenuItem>
            )}
            {!permissions?.canUpdate && !permissions?.canDelete && (
              <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
