import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const masterModules = [
  {
    title: "Allocation",
    href: "/master/allocation/list",
    description: "Manage allocations",
  },
  {
    title: "Allowance Head",
    href: "/master/allowance-head/list",
    description: "Manage allowance heads",
  },
  {
    title: "Banks",
    href: "/master/banks/list",
    description: "Manage banks",
  },
  {
    title: "Bonus Types",
    href: "/master/bonus-types/list",
    description: "Manage bonus types",
  },
  {
    title: "City",
    href: "/master/city/list",
    description: "Manage cities",
  },
  {
    title: "Deduction Head",
    href: "/master/deduction-head/list",
    description: "Manage deduction heads",
  },
  {
    title: "Department",
    href: "/master/department/list",
    description: "Manage departments",
  },
  {
    title: "Designation",
    href: "/master/designation/list",
    description: "Manage designations",
  },
  {
    title: "Employee Grade",
    href: "/master/employee-grade/list",
    description: "Manage employee grades",
  },
  {
    title: "Employee Status",
    href: "/master/employee-status/list",
    description: "Manage employee statuses",
  },
  {
    title: "EOBI",
    href: "/master/eobi/list",
    description: "Manage EOBI",
  },
  {
    title: "Equipment",
    href: "/master/equipment/list",
    description: "Manage equipment",
  },
  {
    title: "Institute",
    href: "/master/institute/list",
    description: "Manage institutes",
  },
  {
    title: "Job Type",
    href: "/master/job-type/list",
    description: "Manage job types",
  },
  {
    title: "Leave Types",
    href: "/master/leave-types/list",
    description: "Manage leave types",
  },
  {
    title: "Leaves Policy",
    href: "/master/leaves-policy/list",
    description: "Manage leaves policies",
  },
  {
    title: "Loan Types",
    href: "/master/loan-types/list",
    description: "Manage loan types",
  },
  {
    title: "Location",
    href: "/master/location/list",
    description: "Manage locations",
  },
  {
    title: "Marital Status",
    href: "/master/marital-status/list",
    description: "Manage marital statuses",
  },
  {
    title: "Provident Fund",
    href: "/master/provident-fund/list",
    description: "Manage provident funds",
  },
  {
    title: "Qualification",
    href: "/master/qualification/list",
    description: "Manage qualifications",
  },
  {
    title: "Rebate Nature",
    href: "/master/rebate-nature/list",
    description: "Manage rebate natures",
  },
  {
    title: "Salary Breakup",
    href: "/master/salary-breakup/list",
    description: "Manage salary breakups",
  },
  {
    title: "Social Security",
    href: "/master/social-security/list",
    description: "Manage social securities",
  },
  {
    title: "Sub Department",
    href: "/master/sub-department/list",
    description: "Manage sub departments",
  },
  {
    title: "Tax Slabs",
    href: "/master/tax-slabs/list",
    description: "Manage tax slabs",
  },
];

export default function MasterPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Master Data Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {masterModules.map((module) => (
          <Link href={module.href} key={module.href} className="block h-full" transitionTypes={["nav-forward"]}>
            <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{module.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
