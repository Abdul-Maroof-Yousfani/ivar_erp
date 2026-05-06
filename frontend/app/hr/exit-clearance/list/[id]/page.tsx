"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { getExitClearanceById, type ExitClearance } from "@/lib/actions/exit-clearance";

export default function ViewExitClearancePage() {
  const params = useParams();
  const router = useRouter();
  const clearanceId = params.id as string;
  const [clearance, setExitClearance] = useState<ExitClearance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExitClearance = async () => {
      try {
        setLoading(true);
        const result = await getExitClearanceById(clearanceId);
        if (result.status && result.data) {
          setExitClearance(result.data as any);
        } else {
          toast.error(result.message || "Failed to fetch exit clearance");
          router.push("/hr/exit-clearance/list");
        }
      } catch (error) {
        console.error("Error fetching exit clearance:", error);
        toast.error("Failed to fetch exit clearance");
        router.push("/hr/exit-clearance/list");
      } finally {
        setLoading(false);
      }
    };

    if (clearanceId) {
      fetchExitClearance();
    }
  }, [clearanceId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!clearance) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Exit clearance not found</p>
        <Link href="/hr/exit-clearance/list">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>
    );
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-[90%] mx-auto pb-10">
      {/* Top Buttons */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/hr/exit-clearance/list">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="border rounded-xl p-4 space-y-6">
        {/* Profile Header */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <div className="flex flex-col items-center text-center gap-2">
              <div>
                <CardTitle className="text-2xl">{clearance.employeeName}</CardTitle>
                <CardDescription className="text-base mt-1">
                  Exit Clearance Record
                </CardDescription>
                <div className="mt-2 flex gap-2 justify-center">
                  <Badge
                    variant={
                      clearance.approvalStatus === "approved"
                        ? "default"
                        : clearance.approvalStatus === "pending"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {clearance.approvalStatus || "pending"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

  {/* Employee Information */}
<Card className="border-none shadow-none">
  <CardHeader>
    <CardTitle>Employee Information</CardTitle>
  </CardHeader>
  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[
      { label: "Employee Name", value: clearance.employeeName },
      { label: "Designation", value: clearance.designation },
      { label: "Department", value: clearance.department },
      { label: "Sub Department", value: clearance.subDepartment },
     
    ].map((item, index) => (
      <div
        key={index}
        className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
      >
        <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
        <p className="text-foreground font-semibold text-1xl mt-1">
          {item.value || "N/A"}
        </p>
      </div>
    ))}
  </CardContent>
</Card>

{/* Exit Information */}
<Card className="border-none shadow-none">
  <CardHeader>
    <CardTitle>Exit Information</CardTitle>
  </CardHeader>
  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[
      { label: "Last Working Date", value: formatDate(clearance.lastWorkingDate) },
      { label: "Contract End Date", value: formatDate(clearance.contractEnd) },
      { label: "Leaving Reason", value: clearance.leavingReason },
      { label: "Date", value: formatDate(clearance.date) },
      { label: "Approval Status", value: clearance.approvalStatus || "Pending" },
    ].map((item, index) => (
      <div
        key={index}
        className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
      >
        <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
        <p className="text-foreground font-semibold text-1xl mt-1">
          {item.value || "N/A"}
        </p>
      </div>
    ))}
  </CardContent>
</Card>


        {/* IT Department Clearance */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>IT Department Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "Access Control", value: clearance.itAccessControl },
              { label: "Password Inactivated", value: clearance.itPasswordInactivated },
              { label: "Laptop Returned", value: clearance.itLaptopReturned },
              { label: "Equipment", value: clearance.itEquipment },
              { label: "WiFi Device", value: clearance.itWifiDevice },
              { label: "Mobile Device", value: clearance.itMobileDevice },
              { label: "SIM Card", value: clearance.itSimCard },
              { label: "Bills Settlement", value: clearance.itBillsSettlement },
            ].map((item, index) => {
              const valStr = item.value ? "✓" : "✗";
              const valueColor = item.value ? "text-foreground font-semibold" : "text-red-600 font-semibold";
              return (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition flex items-center justify-between"
                >
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className={`${valueColor} text-1xl font-bold`}>{valStr}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Finance Department Clearance */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Finance Department Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "Advance", value: clearance.financeAdvance },
              { label: "Loan", value: clearance.financeLoan },
              { label: "Other Liabilities", value: clearance.financeOtherLiabilities },
            ].map((item, index) => {
              const valStr = item.value ? "✓" : "✗";
              const valueColor = item.value ? "text-foreground font-semibold" : "text-red-600 font-semibold";
              return (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition flex items-center justify-between"
                >
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className={`${valueColor} text-1xl font-bold`}>{valStr}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Admin Department Clearance */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Admin Department Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "Vehicle", value: clearance.adminVehicle },
              { label: "Keys", value: clearance.adminKeys },
              { label: "Office Accessories", value: clearance.adminOfficeAccessories },
              { label: "Mobile Phone", value: clearance.adminMobilePhone },
              { label: "Visiting Cards", value: clearance.adminVisitingCards },
            ].map((item, index) => {
              const valStr = item.value ? "✓" : "✗";
              const valueColor = item.value ? "text-foreground font-semibold" : "text-red-600 font-semibold";
              return (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition flex items-center justify-between"
                >
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className={`${valueColor} text-1xl font-bold`}>{valStr}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* HR Department Clearance */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>HR Department Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "EOBI", value: clearance.hrEobi },
              { label: "Provident Fund", value: clearance.hrProvidentFund },
              { label: "ID Card", value: clearance.hrIdCard },
              { label: "Medical", value: clearance.hrMedical },
              { label: "Thumb Impression", value: clearance.hrThumbImpression },
              { label: "Leaves Remaining", value: clearance.hrLeavesRemaining },
              { label: "Other Compensation", value: clearance.hrOtherCompensation },
            ].map((item, index) => {
              const valStr = item.value ? "✓" : "✗";
              const valueColor = item.value ? "text-foreground font-semibold" : "text-red-600 font-semibold";
              return (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition flex items-center justify-between"
                >
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className={`${valueColor} text-1xl font-bold`}>{valStr}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Additional Notes */}
        {clearance.note && (
          <Card className="border-none shadow-none">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{clearance.note}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
