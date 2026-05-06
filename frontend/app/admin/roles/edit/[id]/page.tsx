import { getPermissions } from "@/lib/actions/permissions";
import { getRoleById } from "@/lib/actions/roles";
import { RoleForm } from "../../create/role-form";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AccessDenied } from "@/components/auth/access-denied";

function isSuperAdmin(user: any): boolean {
  const roleName = user?.role?.name || user?.role;
  if (typeof roleName === 'string') {
    const normalized = roleName.toLowerCase().trim();
    return (
      normalized === "super_admin" ||
      normalized === "admin" ||
      normalized === "super admin" ||
      normalized === "super-admin"
    );
  }
  return false;
}

interface EditRolePageProps {
  params: Promise<{
    id: string;
  }>
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const { id } = await params;
  const [{ data: role }, { data: permissions }, user] = await Promise.all([
    getRoleById(id),
    getPermissions(),
    getCurrentUser(),
  ]);

  if (!user || !isSuperAdmin(user)) {
    return <AccessDenied message="Only super-admin users can edit roles." />;
  }

  if (!role) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <RoleForm permissions={permissions} initialData={role} />
    </div>
  );
}
