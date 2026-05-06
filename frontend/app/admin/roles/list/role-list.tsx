"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import DataTable from "@/components/common/data-table";
import { columns, RoleRow } from "./columns";
import { Role, deleteRole } from "@/lib/actions/roles";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

interface RoleListProps {
  initialRoles: Role[];
  userPermissions: string[];
}

export function RoleList({ initialRoles, userPermissions }: RoleListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { isAdmin } = useAuth();

  // Super-admin gets full access; otherwise fall back to permission flags
  const superAdmin = isAdmin();
  const canCreate = superAdmin || userPermissions.includes('role.create');
  const canUpdate = superAdmin || userPermissions.includes('role.update');
  const canDelete = superAdmin || userPermissions.includes('role.delete');

  const handleToggle = () => {
    router.push("/admin/roles/create");
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      let success = true;
      for (const id of ids) {
        const result = await deleteRole(id);
        if (!result.status) {
          success = false;
          toast.error(result.message || `Failed to delete role ${id}`);
        }
      }
      if (success) {
        toast.success("Roles deleted successfully");
      }
      router.refresh();
    });
  };

  const handleEdit = (id: string) => {
    router.push(`/admin/roles/edit/${id}`);
  };

  const data: RoleRow[] = initialRoles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description || "",
    isSystem: role.isSystem,
    usersCount: role._count?.users || 0,
  }));

  return (
    <DataTable
      columns={columns}
      data={data}
      searchFields={[{ key: "name", label: "Name" }, { key: "description", label: "Description" }]}
      toggleAction={canCreate ? handleToggle : undefined}
      onMultiDelete={canDelete ? handleMultiDelete : undefined}
      onRowEdit={canUpdate ? (row) => handleEdit(row.id) : undefined}
      actionText="Add Role"
      title="Roles Management"
    />
  );
}
