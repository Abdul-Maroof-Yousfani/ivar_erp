import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getRoles } from "@/lib/actions/roles";
import { UserAccountForm } from "./user-account-form";

export default async function CreateUserAccountPage() {
  const [{ data: employees }, { data: roles }] = await Promise.all([
    getEmployeesForDropdown(),
    getRoles()
  ]);

  return (
    <div className="container mx-auto py-6">
        <UserAccountForm employees={employees || []} roles={roles || []} />
    </div>
  );
}
