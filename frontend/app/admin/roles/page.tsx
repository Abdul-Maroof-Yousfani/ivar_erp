import { getRoles } from "@/lib/actions/roles";
import { getCurrentUser } from "@/lib/auth";
import { RoleList } from "./list/role-list";
import { redirect } from "next/navigation";
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

export default async function RolesPage() {
  const [{ data: roles }, user] = await Promise.all([
    getRoles(),
    getCurrentUser()
  ]);

  if (!user || !isSuperAdmin(user)) {
    return <AccessDenied message="Only super-admin users can manage roles." />;
  }

  return (
    <div className="container mx-auto py-6">
      <RoleList initialRoles={roles} userPermissions={user?.permissions || []} />
    </div>
  );
}
