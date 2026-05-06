"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/common/data-table";
import { UserRow } from "./columns";
import { User, updateUserRole } from "@/lib/actions/users";
import { Role } from "@/lib/actions/roles";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface UserListProps {
  initialUsers: User[];
  roles: Role[];
  userPermissions: string[];
}

export function UserList({ initialUsers, roles, userPermissions }: UserListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingForUserId, setSavingForUserId] = useState<string | null>(null);

  const canCreate = userPermissions.includes('user.create');
  const canUpdate = userPermissions.includes('user.update');

  const handleCreate = () => {
    router.push("/hr/employee/user-account/create");
  };

  const handleRoleChange = (userId: string, roleId: string | null) => {
    if (!canUpdate) return;
    setSavingForUserId(userId);
    startTransition(async () => {
      const result = await updateUserRole(userId, roleId);
      if (result.status) {
        toast.success("Role assigned successfully");
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setSavingForUserId(null);
    });
  };

  const data: UserRow[] = initialUsers.map((user) => ({
    id: user.id,
    roleId: user.role?.id || null,
    name: user.firstName + " " + user.lastName,
    email: user.email,
    roleName: user.role?.name || "",
    employeeName: user.employee?.employeeName || "N/A",
    department: user.employee?.department?.name || "N/A",
    designation: user.employee?.designation?.name || "N/A",
    status: user.status,
  }));

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "employeeName",
      header: "Employee Name",
    },
    {
      accessorKey: "email",
      header: "Email / Username",
    },
    {
      accessorKey: "roleName",
      header: "Assigned Role",
      cell: ({ row }) => (
        <Select
          value={row.original.roleId || "none"}
          onValueChange={(value) =>
            handleRoleChange(
              row.original.id,
              value === "none" ? null : value,
            )
          }
          disabled={!canUpdate || isPending || savingForUserId === row.original.id}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Role</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
    },
    {
      accessorKey: "designation",
      header: "Designation",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "default" : "destructive"}
        >
          {row.original.status}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchFields={[{ key: "email", label: "Email" }, { key: "name", label: "Name" }]}
      toggleAction={canCreate ? handleCreate : undefined}
      actionText="Create User Account"
      title="User Accounts"
      onMultiDelete={undefined}
    />
  );
}
