"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
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
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { createEOBIs } from "@/lib/actions/eobi";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function AddEOBIPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    employerContribution: "",
    employeeContribution: "",
    selectedMonths: [] as string[], // Array of "YYYY-MM" format
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employerContribution || !formData.employeeContribution) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.selectedMonths.length === 0) {
      toast.error("Please select at least one month");
      return;
    }

    const employerContribution = parseFloat(formData.employerContribution);
    const employeeContribution = parseFloat(formData.employeeContribution);

    if (isNaN(employerContribution) || isNaN(employeeContribution)) {
      toast.error("Please enter valid contribution amounts");
      return;
    }

    // Create EOBI records for each selected month
    const items = formData.selectedMonths.map((monthYear) => {
      const [year, month] = monthYear.split("-").map(Number);
      const formattedMonthYear = format(new Date(year, month - 1, 1), "MMMM yyyy");
      return {
        name: `EOBI ${formattedMonthYear}`,
        employerContribution,
        employeeContribution,
        yearMonth: formattedMonthYear, // Store as "MMMM yyyy" format
      };
    });

    startTransition(async () => {
      const result = await createEOBIs(items);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/eobi/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/eobi/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add EOBI</CardTitle>
          <CardDescription>Create one or more EOBI records</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employerContribution">
                    Employer Contribution <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="employerContribution"
                    type="number"
                    placeholder="2000"
                    value={formData.employerContribution}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, employerContribution: e.target.value }))
                    }
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeContribution">
                    Employee Contribution <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="employeeContribution"
                    type="number"
                    placeholder="400"
                    value={formData.employeeContribution}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, employeeContribution: e.target.value }))
                    }
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="monthYear">
                    Month-Year <span className="text-destructive">*</span>
                  </Label>
                  <MonthYearPicker
                    value={formData.selectedMonths}
                    onChange={(val) => {
                      const months = Array.isArray(val) ? val : (val ? [val] : []);
                      setFormData((prev) => ({ ...prev, selectedMonths: months }));
                    }}
                    disabled={isPending}
                    placeholder="Select month(s) and year"
                    fromYear={2020}
                    toYear={2030}
                    multiple={true}
                  />
                  {formData.selectedMonths.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formData.selectedMonths.length} month(s) selected
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
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
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create {formData.selectedMonths.length > 0 ? `${formData.selectedMonths.length} EOBI(s)` : "EOBI"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
