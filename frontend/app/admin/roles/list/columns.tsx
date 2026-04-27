"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Role } from "@/lib/actions/roles";
import { Badge } from "@/components/ui/badge";

export interface RoleRow {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  usersCount: number;
}

export const columns: ColumnDef<RoleRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        disabled={row.original.isSystem}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Role Name",
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "usersCount",
    header: "Assigned Users",
    cell: ({ row }) => {
        return <Badge variant="secondary">{row.original.usersCount} Users</Badge>
    }
  },
  {
    accessorKey: "isSystem",
    header: "Type",
    cell: ({ row }) => {
      return row.original.isSystem ? <Badge variant="destructive">System</Badge> : <Badge>Custom</Badge>;
    },
  },
];
