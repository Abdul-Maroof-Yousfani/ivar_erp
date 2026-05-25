import { getUsers } from "@/lib/actions/users";
import { getEmployees } from "@/lib/actions/employee";
import { getRoles } from "@/lib/actions/roles";
import { getPermissions } from "@/lib/actions/permissions";
import { getCurrentUser } from "@/lib/auth";
import { EmployeeUserList } from "./employee-user-list";

export default async function UserAccountPage() {
  const [{ data: users }, { data: employees }, { data: roles }, { data: allPermissions }, user] = await Promise.all([
    getUsers(),
    getEmployees({ limit: 10000 }),
    getRoles(),
    getPermissions(),
    getCurrentUser()
  ]);

  return (
    <div className="container mx-auto py-6">
      <EmployeeUserList
        employees={employees || []}
        users={users || []}
        roles={roles || []}
        allPermissions={allPermissions || []}
        userPermissions={user?.permissions || []}
        userRole={user?.role || null}
      />
    </div>
  );
}
