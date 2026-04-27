"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { getExitClearanceById, updateExitClearance, getAllEmployeesForClearance } from "@/lib/actions/exit-clearance";
import type { ExitClearance, Employee } from "@/lib/actions/exit-clearance";

// const locations = ["Head Office", "Branch A", "Branch B", "Remote"];
const leavingReasons = ["Resignation", "Termination", "Contract End", "Retirement", "Other"];

export default function EditExitClearancePage() {
  const router = useRouter();
  const params = useParams();
  const clearanceId = params.id as string;
  const [isPending, startTransition] = useTransition();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ExitClearance | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clearanceResult, employeesResult] = await Promise.all([
          getExitClearanceById(clearanceId),
          getAllEmployeesForClearance(),
        ]);

        if (clearanceResult.status && clearanceResult.data) {
          setFormData(clearanceResult.data);
        } else {
          toast.error(clearanceResult.message || "Failed to fetch clearance");
          router.push("/hr/exit-clearance/list");
        }

        if (employeesResult.status && employeesResult.data) {
          setEmployees(employeesResult.data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
        router.push("/hr/exit-clearance/list");
      } finally {
        setLoading(false);
      }
    };

    if (clearanceId) {
      fetchData();
    }
  }, [clearanceId, router]);

  const updateField = (field: string, value: string | boolean | null) => {
    if (formData) {
      setFormData((prev) => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !formData.employeeName || !formData.lastWorkingDate) {
      toast.error("Please fill required fields");
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateExitClearance(clearanceId, {
          employeeName: formData.employeeName,
          designation: formData.designation || null,
          department: formData.department || null,
          subDepartment: formData.subDepartment || null,
          // location: formData.location || null,
          leavingReason: formData.leavingReason || null,
          contractEnd: formData.contractEnd || null,
          lastWorkingDate: formData.lastWorkingDate,
          reportingManager: formData.reportingManager || null,
          date: formData.date,
          itAccessControl: formData.itAccessControl,
          itPasswordInactivated: formData.itPasswordInactivated,
          itLaptopReturned: formData.itLaptopReturned,
          itEquipment: formData.itEquipment,
          itWifiDevice: formData.itWifiDevice,
          itMobileDevice: formData.itMobileDevice,
          itSimCard: formData.itSimCard,
          itBillsSettlement: formData.itBillsSettlement,
          financeAdvance: formData.financeAdvance,
          financeLoan: formData.financeLoan,
          financeOtherLiabilities: formData.financeOtherLiabilities,
          adminVehicle: formData.adminVehicle,
          adminKeys: formData.adminKeys,
          adminOfficeAccessories: formData.adminOfficeAccessories,
          adminMobilePhone: formData.adminMobilePhone,
          adminVisitingCards: formData.adminVisitingCards,
          hrEobi: formData.hrEobi,
          hrProvidentFund: formData.hrProvidentFund,
          hrIdCard: formData.hrIdCard,
          hrMedical: formData.hrMedical,
          hrThumbImpression: formData.hrThumbImpression,
          hrLeavesRemaining: formData.hrLeavesRemaining,
          hrOtherCompensation: formData.hrOtherCompensation,
          note: formData.note || null,
          approvalStatus: formData.approvalStatus,
        });

        if (result.status) {
          toast.success("Exit clearance updated successfully");
          router.push("/hr/exit-clearance/list");
        } else {
          toast.error(result.message || "Failed to update exit clearance");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to update exit clearance");
      }
    });
  };

  const CheckboxField = ({ id, label, checked }: { id: string; label: string; checked: boolean }) => (
    <div className="flex items-center gap-3 py-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => updateField(id, !!c)}
        disabled={isPending}
      />
      <label htmlFor={id} className="text-sm cursor-pointer">{label}</label>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!formData) {
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

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/exit-clearance/list">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to List</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Information */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
            <CardDescription>Update details of the departing employee</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Employee Name *</Label>
              <Input
                value={formData.employeeName}
                onChange={(e) => updateField("employeeName", e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={formData.designation || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={formData.department || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Sub Department</Label>
              <Input value={formData.subDepartment || ""} disabled className="bg-muted" />
            </div>
            {/* <div className="space-y-2">
              <Label>Location</Label>
              <Select value={formData.location || ""} onValueChange={(v) => updateField("location", v)} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div> */}
            <div className="space-y-2">
              <Label>Leaving Reason</Label>
              <Select value={formData.leavingReason || ""} onValueChange={(v) => updateField("leavingReason", v)} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{leavingReasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contract End</Label>
              <Input
                type="date"
                value={formData.contractEnd ? (typeof formData.contractEnd === 'string' ? formData.contractEnd.split('T')[0] : '') : ""}
                onChange={(e) => updateField("contractEnd", e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Working Date *</Label>
              <Input
                type="date"
                value={formData.lastWorkingDate ? (typeof formData.lastWorkingDate === 'string' ? formData.lastWorkingDate.split('T')[0] : '') : ""}
                onChange={(e) => updateField("lastWorkingDate", e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Reporting Manager</Label>
              <Input
                value={formData.reportingManager || ""}
                onChange={(e) => updateField("reportingManager", e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date ? (typeof formData.date === 'string' ? formData.date.split('T')[0] : '') : ""}
                onChange={(e) => updateField("date", e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Approval Status</Label>
              <Select
                value={formData.approvalStatus || "pending"}
                onValueChange={(v) => updateField("approvalStatus", v)}
                disabled={isPending}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* IT Department */}
        <Card>
          <CardHeader>
            <CardTitle>IT Department – Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <CheckboxField id="itAccessControl" label="Access Control of Software" checked={formData.itAccessControl} />
            <CheckboxField id="itPasswordInactivated" label="Password Inactivated" checked={formData.itPasswordInactivated} />
            <CheckboxField id="itLaptopReturned" label="Laptop Returned" checked={formData.itLaptopReturned} />
            <CheckboxField id="itEquipment" label="IT Equipment (Power Bank / USB / Related Items)" checked={formData.itEquipment} />
            <CheckboxField id="itWifiDevice" label="WiFi Device / Related Equipment" checked={formData.itWifiDevice} />
            <CheckboxField id="itMobileDevice" label="Mobile Device" checked={formData.itMobileDevice} />
            <CheckboxField id="itSimCard" label="SIM Card" checked={formData.itSimCard} />
            <CheckboxField id="itBillsSettlement" label="Bills & Settlement Details" checked={formData.itBillsSettlement} />
          </CardContent>
        </Card>

        {/* Finance Department */}
        <Card>
          <CardHeader>
            <CardTitle>Finance Department – Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <CheckboxField id="financeAdvance" label="Advance" checked={formData.financeAdvance} />
            <CheckboxField id="financeLoan" label="Loan" checked={formData.financeLoan} />
            <CheckboxField id="financeOtherLiabilities" label="Other Liabilities (if any)" checked={formData.financeOtherLiabilities} />
          </CardContent>
        </Card>

        {/* Admin Department */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Department – Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <CheckboxField id="adminVehicle" label="Company-Owned Vehicle" checked={formData.adminVehicle} />
            <CheckboxField id="adminKeys" label="Keys" checked={formData.adminKeys} />
            <CheckboxField id="adminOfficeAccessories" label="Office Accessories" checked={formData.adminOfficeAccessories} />
            <CheckboxField id="adminMobilePhone" label="Mobile Phone / SIM Card" checked={formData.adminMobilePhone} />
            <CheckboxField id="adminVisitingCards" label="Visiting Cards" checked={formData.adminVisitingCards} />
          </CardContent>
        </Card>

        {/* HR Department */}
        <Card>
          <CardHeader>
            <CardTitle>HR Department – Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <CheckboxField id="hrEobi" label="EOBI" checked={formData.hrEobi} />
            <CheckboxField id="hrProvidentFund" label="Provident Fund (PF)" checked={formData.hrProvidentFund} />
            <CheckboxField id="hrIdCard" label="Return of ID / Access Card" checked={formData.hrIdCard} />
            <CheckboxField id="hrMedical" label="Medical" checked={formData.hrMedical} />
            <CheckboxField id="hrThumbImpression" label="Thumb Impression" checked={formData.hrThumbImpression} />
            <CheckboxField id="hrLeavesRemaining" label="Leaves Remaining" checked={formData.hrLeavesRemaining} />
            <CheckboxField id="hrOtherCompensation" label="Any Other Compensation Details" checked={formData.hrOtherCompensation} />
          </CardContent>
        </Card>

        {/* Note */}
        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.note || ""}
              onChange={(e) => updateField("note", e.target.value)}
              placeholder="Additional notes..."
              rows={4}
              disabled={isPending}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-2 sticky bottom-4 bg-background p-4 border rounded-lg shadow-lg">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update Clearance
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
