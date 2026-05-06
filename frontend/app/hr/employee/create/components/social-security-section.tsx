"use client";

import { UseFormReturn, Controller, useFieldArray } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SocialSecurityInstitution = {
  id: string;
  code: string;
  name: string;
  province?: string | null;
};

interface SocialSecuritySectionProps {
  form: UseFormReturn<any>;
  isPending: boolean;
  loadingData: boolean;
  socialSecurityInstitutions: SocialSecurityInstitution[];
  errors: any;
}

export function SocialSecuritySection({
  form,
  isPending,
  loadingData,
  socialSecurityInstitutions,
  errors,
}: SocialSecuritySectionProps) {
  const { control, register, watch, setValue } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "socialSecurityRegistrations",
  });

  const addRegistration = () => {
    append({
      institutionId: "",
      registrationNumber: "",
      cardNumber: "",
      registrationDate: "",
      baseSalary: "",
      monthlyContribution: "",
      status: "active",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Social Security Registration</h3>
          <p className="text-sm text-muted-foreground">
            Register employee with SESSI, PESSE, IESSI or other social security institutions
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRegistration}
          disabled={isPending || loadingData}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Registration
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <p>No social security registrations added yet.</p>
          <p className="text-sm mt-1">Click &quot;Add Registration&quot; to add one.</p>
        </div>
      )}

      {fields.map((field, index) => {
        const institutionId = watch(`socialSecurityRegistrations.${index}.institutionId`);
        const registrationDate = watch(`socialSecurityRegistrations.${index}.registrationDate`);
        const selectedInstitution = socialSecurityInstitutions.find(
          (inst) => inst.id === institutionId
        );

        return (
          <div
            key={field.id}
            className="border rounded-lg p-4 space-y-4 bg-card"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Registration {index + 1}
                {selectedInstitution && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({selectedInstitution.code})
                  </span>
                )}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Institution <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name={`socialSecurityRegistrations.${index}.institutionId`}
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={socialSecurityInstitutions.map((inst) => ({
                        value: inst.id,
                        label: `${inst.code} - ${inst.name}`,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select Institution (SESSI, PESSE, IESSI...)"
                      disabled={isPending || loadingData}
                    />
                  )}
                />
                {errors?.socialSecurityRegistrations?.[index]?.institutionId && (
                  <p className="text-xs text-red-500">
                    {errors.socialSecurityRegistrations[index]?.institutionId?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input
                  {...register(`socialSecurityRegistrations.${index}.registrationNumber`)}
                  placeholder="e.g., SESSI-EMP-2024-001"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input
                  {...register(`socialSecurityRegistrations.${index}.cardNumber`)}
                  placeholder="e.g., CARD-123456"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Registration Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !registrationDate && "text-muted-foreground"
                      )}
                      disabled={isPending}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {registrationDate ? (
                        format(new Date(registrationDate), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={registrationDate ? new Date(registrationDate) : undefined}
                      onSelect={(date) =>
                        setValue(
                          `socialSecurityRegistrations.${index}.registrationDate`,
                          date ? format(date, "yyyy-MM-dd") : ""
                        )
                      }
                      disabled={isPending}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Base Salary</Label>
                <Input
                  {...register(`socialSecurityRegistrations.${index}.baseSalary`)}
                  type="number"
                  step="0.01"
                  placeholder="e.g., 50000"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Monthly Contribution</Label>
                <Input
                  {...register(`socialSecurityRegistrations.${index}.monthlyContribution`)}
                  type="number"
                  step="0.01"
                  placeholder="e.g., 3000"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  name={`socialSecurityRegistrations.${index}.status`}
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "active"}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

