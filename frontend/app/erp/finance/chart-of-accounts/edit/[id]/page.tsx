import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { ChartOfAccountForm } from "../../components/chart-of-account-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { notFound } from "next/navigation";

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditChartOfAccountPage(props: EditPageProps) {
  const params = await props.params;
  const { data: accounts } = await getChartOfAccounts();
  const account = accounts?.find(a => a.id === params.id);

  if (!account) {
    notFound();
  }

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
                    <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/erp/finance/chart-of-accounts">Chart of Accounts</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                    <BreadcrumbPage>Edit</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
                </Breadcrumb>
            </div>
        </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Account</h1>
            <p className="text-muted-foreground">
              Update account details.
            </p>
          </div>
        </div>
        
        <div className="max-w-2xl">
            <ChartOfAccountForm initialData={account} accounts={accounts || []} />
        </div>
      </div>
    </>
  );
}
