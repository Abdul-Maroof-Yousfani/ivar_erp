"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLeaveTypes, LeaveType } from "@/lib/actions/leave-type";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, CalendarIcon } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LeavesPolicyFormProps {
  onSubmit: (data: LeavesPolicyFormData) => Promise<void>;
}

export interface LeavesPolicyFormData {
  name: string;
  dateFrom: Date;
  dateTill: Date;
  fullDayDeductionRate: number;
  halfDayDeductionRate: number;
  shortLeaveDeductionRate: number;
  items: {
    leaveTypeId: string;
    quantity: number;
  }[];
}

const DEDUCTION_RATE_OPTIONS = [
  { value: "1", label: "1 (Day)" },
  { value: "0.5", label: "0.5 (Day)" },
  { value: "0.25", label: "0.25 (Day)" },
  { value: "0.75", label: "0.75 (Day)" },
  { value: "1.5", label: "1.5 (Day)" },
  { value: "2", label: "2 (Day)" },
];

export function LeavesPolicyForm({ onSubmit }: LeavesPolicyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTill, setDateTill] = useState<Date | undefined>(undefined);
  const [fullDayDeductionRate, setFullDayDeductionRate] = useState("1");
  const [halfDayDeductionRate, setHalfDayDeductionRate] = useState("0.5");
  const [shortLeaveDeductionRate, setShortLeaveDeductionRate] = useState("0.25");
  const [items, setItems] = useState<
    { id: number; leaveTypeId: string; quantity: string }[]
  >([{ id: 1, leaveTypeId: "", quantity: "" }]);

  // Load leave types
  useEffect(() => {
    const loadLeaveTypes = async () => {
      try {
        const result = await getLeaveTypes();
        if (result.status && result.data) {
          setLeaveTypes(result.data);
        }
      } catch (error) {
        console.error("Error loading leave types:", error);
        toast.error("Failed to load leave types");
      } finally {
        setLoadingLeaveTypes(false);
      }
    };
    loadLeaveTypes();
  }, []);

  const addItem = () => {
    setItems([...items, { id: Date.now(), leaveTypeId: "", quantity: "" }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: number, field: "leaveTypeId" | "quantity", value: string) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      return sum + qty;
    }, 0);
  };

  const clearForm = () => {
    setName("");
    setDateFrom(undefined);
    setDateTill(undefined);
    setFullDayDeductionRate("1");
    setHalfDayDeductionRate("0.5");
    setShortLeaveDeductionRate("0.25");
    setItems([{ id: 1, leaveTypeId: "", quantity: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Leaves Policy Name is required");
      return;
    }

    if (!dateFrom) {
      toast.error("Policy Date from is required");
      return;
    }

    if (!dateTill) {
      toast.error("Policy Date till is required");
      return;
    }

    if (dateFrom > dateTill) {
      toast.error("Policy Date from must be before Policy Date till");
      return;
    }

    const validItems = items.filter(
      (item) => item.leaveTypeId && item.quantity && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      toast.error("Please add at least one leave type with quantity");
      return;
    }

    const formData: LeavesPolicyFormData = {
      name: name.trim(),
      dateFrom,
      dateTill,
      fullDayDeductionRate: parseFloat(fullDayDeductionRate),
      halfDayDeductionRate: parseFloat(halfDayDeductionRate),
      shortLeaveDeductionRate: parseFloat(shortLeaveDeductionRate),
      items: validItems.map((item) => ({
        leaveTypeId: item.leaveTypeId,
        quantity: parseInt(item.quantity),
      })),
    };

    startTransition(async () => {
      await onSubmit(formData);
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
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
          <CardTitle>Create Leaves Policy Form</CardTitle>
          <CardDescription>
            Define a new leave policy for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Policy Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Policy Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Leaves Policy Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter policy name"
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Policy Date from <span className="text-red-500">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "MM/dd/yyyy") : "mm/dd/yyyy"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>
                    Policy Date till <span className="text-red-500">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTill && "text-muted-foreground"
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTill ? format(dateTill, "MM/dd/yyyy") : "mm/dd/yyyy"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTill}
                        onSelect={setDateTill}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Deduction Rates Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Deduction Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullDay">
                    Full Day Deduction Rate <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={fullDayDeductionRate}
                    onValueChange={setFullDayDeductionRate}
                    disabled={isPending}
                  >
                    <SelectTrigger id="fullDay">
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEDUCTION_RATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="halfDay">
                    Half Day Deduction Rate <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={halfDayDeductionRate}
                    onValueChange={setHalfDayDeductionRate}
                    disabled={isPending}
                  >
                    <SelectTrigger id="halfDay">
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEDUCTION_RATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortLeave">
                    Short Leave Deduction Rate <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={shortLeaveDeductionRate}
                    onValueChange={setShortLeaveDeductionRate}
                    disabled={isPending}
                  >
                    <SelectTrigger id="shortLeave">
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEDUCTION_RATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Leaves Type and Quantity Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Leaves Type and Quantity</h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      {index === 0 && (
                        <Label>
                          Leaves Type <span className="text-red-500">*</span>
                        </Label>
                      )}
                      <Select
                        value={item.leaveTypeId}
                        onValueChange={(value) => updateItem(item.id, "leaveTypeId", value)}
                        disabled={isPending || loadingLeaveTypes}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((leaveType) => (
                            <SelectItem key={leaveType.id} value={leaveType.id}>
                              {leaveType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-2">
                      {index === 0 && (
                        <Label>
                          No. of Leaves <span className="text-red-500">*</span>
                        </Label>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        placeholder="Enter quantity"
                        disabled={isPending}
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1 || isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Total and Action Buttons */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={addItem}
                  disabled={isPending}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  + Add more leave type
                </button>
                <div className="flex items-center gap-3">
                  <Label className="text-base font-medium">Total Leaves:</Label>
                  <span className="text-lg font-semibold text-primary">{calculateTotal()}</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearForm}
                  disabled={isPending}
                >
                  Clear Form
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Policy
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

