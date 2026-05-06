"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SalarySection({ form, isPending, errors }: { form: any; isPending: boolean; errors: any }) {
  const { register } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label>Employee Salary (Compensation) <span className="text-destructive">*</span></Label>
        <Input type="number" {...register("employeeSalary")} disabled={isPending} />
        {errors?.employeeSalary && <p className="text-xs text-red-500">{errors.employeeSalary.message}</p>}
      </div>
    </div>
  );
}
