import { getLeavesPolicyById } from "@/lib/actions/leaves-policy";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ViewLeavesPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: policy } = await getLeavesPolicyById(id);

  if (!policy) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/master/leaves-policy/list">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Leaves Policy Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Policy Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Leaves Policy Name
              </label>
              <p className="text-base">{policy.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Policy Date From
              </label>
              <p className="text-base">
                {policy.policyDateFrom
                  ? format(new Date(policy.policyDateFrom), "MM/dd/yyyy")
                  : "—"}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Policy Date Till
              </label>
              <p className="text-base">
                {policy.policyDateTill
                  ? format(new Date(policy.policyDateTill), "MM/dd/yyyy")
                  : "—"}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Full Day Deduction Rate
              </label>
              <p className="text-base">
                {policy.fullDayDeductionRate ?? "—"} (Day)
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Half Day Deduction Rate
              </label>
              <p className="text-base">
                {policy.halfDayDeductionRate ?? "—"} (Day)
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Short Leave Deduction Rate
              </label>
              <p className="text-base">
                {policy.shortLeaveDeductionRate ?? "—"} (Day)
              </p>
            </div>
            {policy.details && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Details
                </label>
                <p className="text-base">{policy.details}</p>
              </div>
            )}
          </div>

          {/* Leave Types Table */}
          {policy.leaveTypes && policy.leaveTypes.length > 0 && (
            <div className="space-y-4">
              <label className="text-sm font-medium">Leaves Type</label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leaves Type</TableHead>
                    <TableHead>No. of Leaves</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.leaveTypes.map((lt, index) => (
                    <TableRow key={index}>
                      <TableCell>{lt.leaveTypeName}</TableCell>
                      <TableCell>{lt.numberOfLeaves}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

