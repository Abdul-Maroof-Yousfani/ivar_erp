import { getCompanies } from "@/lib/actions/companies";
import { getCurrentUser } from "@/lib/auth";
import { CompanyList } from "./company-list";

export default async function CompaniesPage() {
  const [companiesResult, user] = await Promise.all([
    getCompanies(),
    getCurrentUser(),
  ]);

  const userPermissions = user?.permissions || [];
  console.log(user);
  return (
    <div className="container mx-auto py-6">
      <CompanyList
        initialCompanies={companiesResult.data}
        userPermissions={userPermissions}
      />
    </div>
  );
}


