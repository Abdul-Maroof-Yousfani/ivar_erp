"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLeavesPolicy } from "@/lib/actions/leaves-policy";
import { getLeaveTypes, LeaveType } from "@/lib/actions/leave-type";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Loader2, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LeaveTypeRow {
  id: number;
  leaveTypeId: string;
  numberOfLeaves: string;
}

export default function AddLeavesPolicyPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [policyDateFrom, setPolicyDateFrom] = useState<Date | undefined>();
  const [policyDateTill, setPolicyDateTill] = useState<Date | undefined>();
  const [fullDayDeductionRate, setFullDayDeductionRate] = useState("1");
  const [halfDayDeductionRate, setHalfDayDeductionRate] = useState("0.5");
  const [shortLeaveDeductionRate, setShortLeaveDeductionRate] =
    useState("0.25");
  const [leaveTypeRows, setLeaveTypeRows] = useState<LeaveTypeRow[]>([
    { id: 1, leaveTypeId: "", numberOfLeaves: "" },
  ]);

  useEffect(() => {
    getLeaveTypes().then((res) => {
      if (res.status && res.data) {
        setLeaveTypes(res.data);
      }
    });
  }, []);

  const addLeaveTypeRow = () => {
    setLeaveTypeRows([
      ...leaveTypeRows,
      { id: Date.now(), leaveTypeId: "", numberOfLeaves: "" },
    ]);
  };

  const removeLeaveTypeRow = (id: number) => {
    if (leaveTypeRows.length > 1) {
      setLeaveTypeRows(leaveTypeRows.filter((r) => r.id !== id));
    }
  };

  const updateLeaveTypeRow = (
    id: number,
    field: "leaveTypeId" | "numberOfLeaves",
    value: string
  ) => {
    setLeaveTypeRows(
      leaveTypeRows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Leaves Policy Name is required");
      return;
    }

    if (!policyDateFrom) {
      toast.error("Policy Date from is required");
      return;
    }

    if (!policyDateTill) {
      toast.error("Policy Date till is required");
      return;
    }

    const validLeaveTypes = leaveTypeRows.filter(
      (r) => r.leaveTypeId && r.numberOfLeaves
    );

    if (validLeaveTypes.length === 0) {
      toast.error("Please add at least one leave type");
      return;
    }

    startTransition(async () => {
      const result = await createLeavesPolicy({
        name: name.trim(),
        details: details.trim() || undefined,
        policyDateFrom: policyDateFrom.toISOString(),
        policyDateTill: policyDateTill.toISOString(),
        fullDayDeductionRate: parseFloat(fullDayDeductionRate),
        halfDayDeductionRate: parseFloat(halfDayDeductionRate),
        shortLeaveDeductionRate: parseFloat(shortLeaveDeductionRate),
        leaveTypes: validLeaveTypes.map((r) => ({
          leaveTypeId: r.leaveTypeId,
          numberOfLeaves: parseInt(r.numberOfLeaves) || 0,
        })),
      });

      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/leaves-policy/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleClear = () => {
    setName("");
    setDetails("");
    setPolicyDateFrom(undefined);
    setPolicyDateTill(undefined);
    setFullDayDeductionRate("1");
    setHalfDayDeductionRate("0.5");
    setShortLeaveDeductionRate("0.25");
    setLeaveTypeRows([{ id: 1, leaveTypeId: "", numberOfLeaves: "" }]);
  };

  const deductionRateOptions = [
    { value: "0.25", label: "0.25 (Day)" },
    { value: "0.5", label: "0.5 (Day)" },
    { value: "1", label: "1 (Day)" },
    { value: "1.5", label: "1.5 (Day)" },
    { value: "2", label: "2 (Day)" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/master/leaves-policy/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Leaves Policy Form</CardTitle>
          <CardDescription>
            Define leave policies with dates, deduction rates, and leave types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Policy Name and Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Leaves Policy Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Policy name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Policy Date from <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !policyDateFrom && "text-muted-foreground"
                      )}
                      disabled={isPending}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {policyDateFrom ? (
                        format(policyDateFrom, "MM/dd/yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={policyDateFrom}
                      onSelect={setPolicyDateFrom}
                      disabled={isPending}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Policy Date till <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !policyDateTill && "text-muted-foreground"
                      )}
                      disabled={isPending}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {policyDateTill ? (
                        format(policyDateTill, "MM/dd/yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={policyDateTill}
                      onSelect={setPolicyDateTill}
                      disabled={isPending}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Deduction Rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Full Day Deduction Rate <span className="text-red-500">*</span></Label>
                <Select
                  value={fullDayDeductionRate}
                  onValueChange={setFullDayDeductionRate}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionRateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Half Day Deduction Rate <span className="text-red-500">*</span></Label>
                <Select
                  value={halfDayDeductionRate}
                  onValueChange={setHalfDayDeductionRate}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionRateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Short Leave Deduction Rate <span className="text-red-500">*</span></Label>
                <Select
                  value={shortLeaveDeductionRate}
                  onValueChange={setShortLeaveDeductionRate}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionRateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Leave Types */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium">Leave Types <span className="text-red-500">*</span></Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLeaveTypeRow}
                  disabled={isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More Leaves Type
                </Button>
              </div>
              <div className="space-y-3">
                {leaveTypeRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                  >
                    <div className="space-y-2">
                      {index === 0 && <Label>Leaves Type <span className="text-red-500">*</span></Label>}
                      <Select
                        value={row.leaveTypeId}
                        onValueChange={(value) =>
                          updateLeaveTypeRow(row.id, "leaveTypeId", value)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((lt) => (
                            <SelectItem key={lt.id} value={lt.id}>
                              {lt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      {index === 0 && <Label>No. of Leaves <span className="text-red-500">*</span></Label>}
                      <Input
                        type="number"
                        min="0"
                        placeholder="Number of leaves"
                        value={row.numberOfLeaves}
                        onChange={(e) =>
                          updateLeaveTypeRow(
                            row.id,
                            "numberOfLeaves",
                            e.target.value
                          )
                        }
                        disabled={isPending}
                        required
                      />
                    </div>
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLeaveTypeRow(row.id)}
                        disabled={leaveTypeRows.length === 1 || isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Details (Optional) */}
            <div className="space-y-2">
              <Label>Details (Optional)</Label>
              <Input
                placeholder="Additional details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Total */}
            <div className="space-y-2">
              <Label className="font-semibold">Total</Label>
              <Input
                type="number"
                value={leaveTypeRows.reduce((sum, row) => {
                  const num = parseInt(row.numberOfLeaves) || 0;
                  return sum + num;
                }, 0)}
                disabled
                className="font-semibold bg-muted"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                disabled={isPending}
              >
                Clear Form
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
