"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Controller } from "react-hook-form";
import { ProtectedSalaryInput } from "@/components/common/protected-salary-input";

export function SalarySection({ form, isPending, errors }: { form: any; isPending: boolean; errors: any }) {
  const { control } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label>Employee Salary (Compensation) <span className="text-destructive">*</span></Label>
        <Controller
          name="employeeSalary"
          control={control}
          render={({ field }) => (
            <ProtectedSalaryInput
              {...field}
              placeholder="Enter employee salary"
              disabled={isPending}
            />
          )}
        />
        {errors?.employeeSalary && <p className="text-xs text-red-500">{errors.employeeSalary.message}</p>}
      </div>
    </div>
  );
}
