import { getPermissions } from "@/lib/actions/permissions";
import { RoleForm } from "./role-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
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

export default async function CreateRolePage() {
  const [{ data: permissions, status }, user] = await Promise.all([
    getPermissions(),
    getCurrentUser(),
  ]);

  if (!user || !isSuperAdmin(user)) {
    return <AccessDenied message="Only super-admin users can create roles." />;
  }

  return (
    <div className="container mx-auto py-6">
        {!status && (
            <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    Failed to load permissions. Please ensure you are logged in and have the necessary access.
                </AlertDescription>
            </Alert>
        )}
        <RoleForm permissions={permissions || []} />
    </div>
  );
}
