import { getUsers } from "@/lib/actions/users";
import { getEmployees } from "@/lib/actions/employee";
import { getRoles } from "@/lib/actions/roles";
import { getCurrentUser } from "@/lib/auth";
import { EmployeeUserList } from "./employee-user-list";

export default async function UserAccountPage() {
  const [{ data: users }, { data: employees }, { data: roles }, user] = await Promise.all([
    getUsers(),
    getEmployees(),
    getRoles(),
    getCurrentUser()
  ]);

  return (
    <div className="container mx-auto py-6">
      <EmployeeUserList
        employees={employees || []}
        users={users || []}
        roles={roles || []}
        userPermissions={user?.permissions || []}
        userRole={user?.role || null}
      />
    </div>
  );
}
