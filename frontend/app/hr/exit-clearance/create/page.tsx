"use client";

import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
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
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { getAllEmployeesForClearance, createExitClearance } from "@/lib/actions/exit-clearance";
import type { Employee } from "@/lib/actions/exit-clearance";

// const locations = ["Head Office", "Branch A", "Branch B", "Remote"];
const leavingReasons = ["Resignation", "Termination", "Contract End", "Retirement", "Other"];

export default function CreateExitClearancePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    selectedEmployeeId: "",
    employeeName: "",
    designation: "",
    department: "",
    subDepartment: "",
    // location: "",
    leavingReason: "",
    contractEnd: "",
    lastWorkingDate: "",
    date: new Date().toISOString().split("T")[0],
    // IT Department
    itAccessControl: false,
    itPasswordInactivated: false,
    itLaptopReturned: false,
    itEquipment: false,
    itWifiDevice: false,
    itMobileDevice: false,
    itSimCard: false,
    itBillsSettlement: false,
    // Finance Department
    financeAdvance: false,
    financeLoan: false,
    financeOtherLiabilities: false,
    // Admin Department
    adminVehicle: false,
    adminKeys: false,
    adminOfficeAccessories: false,
    adminMobilePhone: false,
    adminVisitingCards: false,
    // HR Department
    hrEobi: false,
    hrProvidentFund: false,
    hrIdCard: false,
    hrMedical: false,
    hrThumbImpression: false,
    hrLeavesRemaining: false,
    hrOtherCompensation: false,
    // Note
    note: "",
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const result = await getAllEmployeesForClearance();
        console.log("Employees fetch result:", result);
        if (result.status && result.data) {
          console.log("Employees data:", result.data);
          setEmployees(result.data);
          if (result.data.length === 0) {
            toast.info("No employees available for clearance");
          }
        } else {
          toast.error(result.message || "Failed to load employees");
        }
      } catch (error) {
        console.error("Failed to fetch employees:", error);
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmployeeChange = (employeeId: string) => {
    const selected = employees.find((e) => e.id === employeeId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        selectedEmployeeId: employeeId,
        employeeName: selected.employeeName,
        designation: selected.designation,
        department: selected.department,
        subDepartment: selected.subDepartment || "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.selectedEmployeeId || !formData.employeeName || !formData.lastWorkingDate) {
      toast.error("Please fill required fields");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createExitClearance({
          employeeId: formData.selectedEmployeeId,
          employeeName: formData.employeeName,
          designation: formData.designation || null,
          department: formData.department || null,
          subDepartment: formData.subDepartment || null,
          // location: formData.location || null,
          leavingReason: formData.leavingReason || null,
          contractEnd: formData.contractEnd || null,
          lastWorkingDate: formData.lastWorkingDate,
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
          approvalStatus: "pending",
        });

        if (result.status) {
          toast.success(result.message || "Exit clearance created successfully");
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/exit-clearance/list");
          });
        } else {
          toast.error(result.message || "Failed to create exit clearance");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create exit clearance");
      }
    });
  };

  const CheckboxField = ({ id, label, checked }: { id: string; label: string; checked: boolean }) => (
    <div className="flex items-center gap-3 py-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => updateField(id, !!c)} disabled={isPending} />
      <label htmlFor={id} className="text-sm cursor-pointer">{label}</label>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/exit-clearance/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to List</Button>
        </Link>
      </div>

      <div className="border rounded-xl p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Information */}
        <Card className="border-0 shadow-none bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Employee Information</CardTitle>
            <CardDescription>Basic details of the departing employee</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Employee Name *</Label>
              {loading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select value={formData.selectedEmployeeId} onValueChange={handleEmployeeChange} disabled={isPending || loading}>
                  <SelectTrigger>
                    <SelectValue placeholder={employees.length > 0 ? "Select employee" : "No employees available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length > 0 ? (
                      employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.employeeName} - {e.employeeId}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No employees available</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={formData.designation} disabled className="bg-muted" placeholder="Select employee to auto-fill" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={formData.department} disabled className="bg-muted" placeholder="Select employee to auto-fill" />
            </div>
            <div className="space-y-2">
              <Label>Sub Department</Label>
              <Input value={formData.subDepartment} disabled className="bg-muted" placeholder="Select employee to auto-fill" />
            </div>
            {/* <div className="space-y-2">
              <Label>Location</Label>
              <Select value={formData.location} onValueChange={(v) => updateField("location", v)} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div> */}
            <div className="space-y-2">
              <Label>Leaving Reason</Label>
              <Select value={formData.leavingReason} onValueChange={(v) => updateField("leavingReason", v)} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{leavingReasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contract End</Label>
              <DatePicker 
                value={formData.contractEnd || undefined} 
                onChange={(value) => updateField("contractEnd", value)} 
                disabled={isPending}
                placeholder="Select contract end date"
              />
            </div>
            <div className="space-y-2">
              <Label>Last Working Date *</Label>
              <DatePicker 
                value={formData.lastWorkingDate || undefined} 
                onChange={(value) => updateField("lastWorkingDate", value)} 
                disabled={isPending}
                placeholder="Select last working date"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker 
                value={formData.date || undefined} 
                onChange={(value) => updateField("date", value)} 
                disabled={isPending}
                placeholder="Select date"
              />
            </div>
          </CardContent>
        </Card>

        {/* IT Department */}
        <Card className="border-0 shadow-none bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">IT Department – Clearance</CardTitle>
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
        <Card className="border-0 shadow-none bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Finance Department – Clearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <CheckboxField id="financeAdvance" label="Advance" checked={formData.financeAdvance} />
            <CheckboxField id="financeLoan" label="Loan" checked={formData.financeLoan} />
            <CheckboxField id="financeOtherLiabilities" label="Other Liabilities (if any)" checked={formData.financeOtherLiabilities} />
          </CardContent>
        </Card>

        {/* Admin Department */}
        <Card className="border-0 shadow-none bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Admin Department – Clearance</CardTitle>
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
        <Card className="border-0 shadow-none bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">HR Department – Clearance</CardTitle>
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
        <Card className="border-0 shadow-none bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={formData.note} onChange={(e) => updateField("note", e.target.value)} placeholder="Additional notes..." rows={4} disabled={isPending} />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Clearance
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              startTransition(() => {
                addTransitionType("nav-back");
                router.back();
              });
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}

