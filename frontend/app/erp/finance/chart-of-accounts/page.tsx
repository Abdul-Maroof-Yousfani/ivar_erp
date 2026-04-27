import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { ChartOfAccountList } from "./components/chart-of-account-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { hasPermission } from "@/lib/auth";


export default async function ChartOfAccountsPage() {
  const { data: accounts } = await getChartOfAccounts();
  const canCreate = await hasPermission("erp.finance.chart-of-account.create");
  const canUpdate = await hasPermission("erp.finance.chart-of-account.update");
  const canDelete = await hasPermission("erp.finance.chart-of-account.delete");

  return (
    <>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/erp/finance">Finance</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                    <BreadcrumbPage>Chart of Accounts</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
                </Breadcrumb>
            </div>
        </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Manage your financial accounts hierarchy.
            </p>
          </div>
          {canCreate && (
            <Link href="/erp/finance/chart-of-accounts/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </Link>
          )}
        </div>
        
        <ChartOfAccountList initialData={accounts || []} permissions={{ canUpdate, canDelete }} />
      </div>
    </>
  );
}
