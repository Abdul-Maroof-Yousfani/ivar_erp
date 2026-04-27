"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  flexRender,
  ExpandedState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { columns } from "./columns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface ChartOfAccountListProps {
  initialData: ChartOfAccount[];
  permissions?: {
    canUpdate: boolean;
    canDelete: boolean;
  };
}

export function ChartOfAccountList({ initialData, permissions }: ChartOfAccountListProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [expanded, setExpanded] = React.useState<ExpandedState>(true);

  // Transform flat data to tree
  const data = React.useMemo(() => {
    const map = new Map<string, ChartOfAccount>();
    const roots: ChartOfAccount[] = [];

    // Initialize map
    initialData.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    // Build tree
    initialData.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [initialData]);

  const table = useReactTable({
    data,
    columns,
    meta: {
      permissions
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      expanded,
    },
    initialState: {
      pagination: {
        pageSize: 1000,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter by name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false} mode="sync">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/50", // Base TableRow styles
                      "cursor-pointer",
                    )}
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell 
                        key={cell.id}
                        className={cn(
                          "py-2", // Reduce default padding slightly for tighter tree view
                          cell.column.id === "name" && "p-0 relative" // Remove padding for tree column to allow full-height lines
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} row(s)
        </div>
      </div>
    </div>
  );
}
