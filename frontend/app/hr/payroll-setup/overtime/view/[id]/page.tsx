import { getOvertimeRequestById } from "@/lib/actions/overtime";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit, Calendar, Clock, User, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewOvertimePage({ params }: PageProps) {
  const { id } = await params;
  const overtimeResult = await getOvertimeRequestById(id);

  if (!overtimeResult.status || !overtimeResult.data) {
    notFound();
  }

  const overtime = overtimeResult.data;

  // Format date
  const formattedDate = overtime.date
    ? format(new Date(overtime.date), "dd MMM yyyy")
    : "N/A";

  // Get status badge variant
  const getStatusVariant = (status: string | undefined) => {
    if (!status) return "secondary";
    switch (status.toLowerCase()) {
      case "approved":
        return "default";
      case "pending":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/hr/payroll-setup/overtime/view">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <Link href={`/hr/payroll-setup/overtime/edit/${id}`}>
          <Button size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">
                Overtime Request Details
              </CardTitle>
              <CardDescription className="text-base mt-1">
                View complete information about the overtime request
              </CardDescription>
            </div>
            <Badge
              variant={getStatusVariant(overtime.status)}
              className="text-sm px-3 py-1"
            >
              {overtime.status || "Pending"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Employee Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Employee
              </Label>
              <div className="text-base font-medium">
                {overtime.employeeName || "N/A"}
              </div>
              {overtime.employeeCode && (
                <div className="text-sm text-muted-foreground">
                  ID: {overtime.employeeCode}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Overtime Type
              </Label>
              <Badge variant="outline" className="text-sm">
                {overtime.overtimeType === "weekday" ? "Weekday" : "Holiday"}
              </Badge>
            </div>
          </div>

          {/* Request Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Title
              </Label>
              <div className="text-base">{overtime.title || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date
              </Label>
              <div className="text-base">{formattedDate}</div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description
            </Label>
            <div className="text-base bg-muted/50 p-4 rounded-md min-h-[80px]">
              {overtime.description || "No description provided"}
            </div>
          </div>

          {/* Overtime Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Weekday Overtime Hours
              </Label>
              <div className="text-2xl font-bold">
                {overtime.weekdayOvertimeHours?.toFixed(2) || "0.00"}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Holiday Overtime Hours
              </Label>
              <div className="text-2xl font-bold">
                {overtime.holidayOvertimeHours?.toFixed(2) || "0.00"}
              </div>
            </div>
          </div>

          {/* Approval Status */}
          {(overtime.approval1 || overtime.approval2) && (
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm font-medium text-muted-foreground">
                Approval Status
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overtime.approval1 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Approval 1
                    </Label>
                    <Badge
                      variant={getStatusVariant(overtime.approval1)}
                      className="text-sm"
                    >
                      {overtime.approval1}
                    </Badge>
                  </div>
                )}
                {overtime.approval2 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Approval 2
                    </Label>
                    <Badge
                      variant={getStatusVariant(overtime.approval2)}
                      className="text-sm"
                    >
                      {overtime.approval2}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Created At
              </Label>
              <div className="text-sm">
                {overtime.createdAt
                  ? format(new Date(overtime.createdAt), "dd MMM yyyy, hh:mm a")
                  : "N/A"}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Updated At
              </Label>
              <div className="text-sm">
                {overtime.updatedAt
                  ? format(new Date(overtime.updatedAt), "dd MMM yyyy, hh:mm a")
                  : "N/A"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

