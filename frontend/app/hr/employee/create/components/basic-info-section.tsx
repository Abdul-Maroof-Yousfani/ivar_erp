"use client";

import { Controller, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Upload } from "lucide-react";

type Option = { id: string; name: string; allocationId?: string | null };

// Phone number formatting function - formats like CNIC (03XX-XXXXXXX)
const formatPhone = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) {
    return digits;

  } else if (digits.length <= 11) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else {
    return `${digits.slice(0, 4)}-${digits.slice(4, 11)}`;
  }
};

export function BasicInfoSection({ form, isPending, loadingData, departments, subDepartments, department, loadingSubDepartments, employeeGrades, designations, maritalStatuses, employeeStatuses, errors, formatCNIC, nationalities, genders, states, cities, state, loadingCities, daysOff, workingHoursPolicies, locations, leavesPolicies, allocations, documents, handleFileChange, employees, documentUrls, mode }: {
  form: UseFormReturn<any>;
  isPending: boolean;
  loadingData: boolean;
  departments: Option[];
  subDepartments: Option[];
  department?: string;
  loadingSubDepartments: boolean;
  employeeGrades: { id: string; grade: string }[];
  designations: Option[];
  maritalStatuses: Option[];
  employeeStatuses: { id: string; status: string }[];
  errors: Record<string, { message?: string }>;
  formatCNIC: (val: string) => string;
  nationalities: string[];
  genders: string[];
  states: Option[];
  cities: { id: string; name: string }[];
  state?: string;
  loadingCities: boolean;
  daysOff: string[];
  workingHoursPolicies: { id: string; name: string; isDefault?: boolean }[];
  locations: { id: string; name: string; isDefault?: boolean }[];
  leavesPolicies: { id: string; name: string; isDefault?: boolean }[];
  allocations: { id: string; name: string }[];
  documents: Record<string, File | null>;
  handleFileChange: (key: string, file: File | null) => void;
  employees: { id: string; employeeName: string; employeeId: string }[];
  documentUrls?: Record<string, string>;
  mode?: "create" | "edit" | "rejoin";
}) {
  const { register, control } = form;
  const lifetimeCnic = useWatch({ control, name: "lifetimeCnic" });
  const isEobi = useWatch({ control, name: "eobi" });
  const allocation = useWatch({ control, name: "allocation" });
  const currentDepartment = useWatch({ control, name: "department" });

  // Filter departments based on selected allocation
  // In edit mode, always include the current department even if it doesn't match the allocation filter
  const filteredDepartments = allocation
    ? departments.filter((d) => d.allocationId === allocation || (mode === "edit" && d.id === currentDepartment))
    : departments;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1 md:col-span-3 text-lg font-bold text-muted-foreground border-b border-muted-foreground pb-2">
        Employment Details
      </div>

      <div className="space-y-2">
        <Label>Employee ID <span className="text-destructive">*</span></Label>
        <Input placeholder="456XXXXXXXXXX" {...register("employeeId")} disabled={isPending} />
        {errors?.employeeId && <p className="text-xs text-red-500">{errors.employeeId.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Employee Name <span className="text-destructive">*</span></Label>
        <Input placeholder="(eg John Doe)" {...register("employeeName")} disabled={isPending} />
        {errors?.employeeName && <p className="text-xs text-red-500">{errors.employeeName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Father / Husband Name <span className="text-destructive">*</span></Label>
        <Input placeholder="(eg Richard Roe)" {...register("fatherHusbandName")} disabled={isPending} />
        {errors?.fatherHusbandName && <p className="text-xs text-red-500">{errors.fatherHusbandName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Allocation <span className="text-destructive">*</span></Label>
        <Controller name="allocation" control={control} render={({ field }) => (
          <Autocomplete
            options={allocations.map(a => ({ value: a.id, label: a.name }))}
            value={field.value as string | undefined}
            onValueChange={(val) => {
              field.onChange(val);
              // Reset dependent fields
              form.setValue("department", "");
              form.setValue("subDepartment", "");
            }}
            placeholder="Select Allocation"
            disabled={isPending || loadingData}
          />
        )} />
        {errors?.allocation && <p className="text-xs text-red-500">{errors.allocation.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Department <span className="text-destructive">*</span></Label>
        <Controller name="department" control={control} render={({ field }) => (
          <Autocomplete
            options={filteredDepartments.map(d => ({ value: d.id, label: d.name }))}
            value={field.value as string | undefined}
            onValueChange={(val) => {
              field.onChange(val);
              // Reset dependent field
              form.setValue("subDepartment", "");
            }}
            placeholder={allocation || mode === "edit" ? "Select Department" : "Select Allocation first"}
            disabled={isPending || (!allocation && mode !== "edit") || loadingData}
          />
        )} />
        {errors?.department && <p className="text-xs text-red-500">{errors.department.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Sub Department</Label>
        <Controller name="subDepartment" control={control} render={({ field }) => (
          <Autocomplete options={subDepartments.map(sd => ({ value: sd.id, label: sd.name }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder={department ? "Select Sub Department" : "Select Department first"} disabled={isPending || !department || loadingData || loadingSubDepartments} isLoading={loadingSubDepartments} />
        )} />
      </div>
      <div className="space-y-2">
        <Label>Employee Grade <span className="text-destructive">*</span></Label>
        <Controller name="employeeGrade" control={control} render={({ field }) => (
          <Autocomplete options={employeeGrades.map(g => ({ value: g.id, label: g.grade }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder="Select Grade" disabled={isPending || loadingData} />
        )} />
        {errors?.employeeGrade && <p className="text-xs text-red-500">{errors.employeeGrade.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Attendance ID <span className="text-destructive">*</span></Label>
        <Input placeholder="(eg ATT-00123)" {...register("attendanceId")} disabled={isPending} />
        {errors?.attendanceId && <p className="text-xs text-red-500">{errors.attendanceId.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Designation <span className="text-destructive">*</span></Label>
        <Controller name="designation" control={control} render={({ field }) => (
          <Autocomplete options={designations.map(d => ({ value: d.id, label: d.name }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder="Select Designation" disabled={isPending || loadingData} />
        )} />
        {errors?.designation && <p className="text-xs text-red-500">{errors.designation.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Marital Status</Label>
        <Controller name="maritalStatus" control={control} render={({ field }) => (
          <Autocomplete options={maritalStatuses.map(ms => ({ value: ms.id, label: ms.name }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder="Select Marital Status" disabled={isPending || loadingData} />
        )} />
        {errors?.maritalStatus && <p className="text-xs text-red-500">{errors.maritalStatus.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Employment Status</Label>
        <Controller name="employmentStatus" control={control} render={({ field }) => (
          <Autocomplete options={employeeStatuses.map(es => ({ value: es.id, label: es.status }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder="Select Employment Status" disabled={isPending || loadingData} />
        )} />
        {errors?.employmentStatus && <p className="text-xs text-red-500">{errors.employmentStatus.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Probation / Internship Expiry Date</Label>
        <Controller name="probationExpiryDate" control={control} render={({ field }) => (
          <DatePicker value={field.value as string | undefined} onChange={field.onChange} disabled={isPending} />
        )} />
      </div>

      <div className="space-y-2">
        <Label>CNIC Number <span className="text-destructive">*</span></Label>
        <Controller name="cnicNumber" control={control} render={({ field }) => (
          <Input
            placeholder="00000-0000000-0"
            value={(field.value as string | undefined) || ""}
            onChange={(e) => field.onChange(formatCNIC(e.target.value))}
            maxLength={15}
            disabled={isPending || mode === "rejoin"}
            readOnly={mode === "rejoin"}
            className={mode === "rejoin" ? "bg-muted cursor-not-allowed" : ""}
          />
        )} />
        {errors?.cnicNumber && <p className="text-xs text-red-500">{errors.cnicNumber.message}</p>}
        {mode === "rejoin" && <p className="text-xs text-muted-foreground">CNIC cannot be changed on rejoin</p>}
      </div>
      <div className="space-y-2">
        <Label>CNIC Expiry Date</Label>
        <Controller name="cnicExpiryDate" control={control} render={({ field }) => (
          <DatePicker value={field.value as string | undefined} onChange={field.onChange} disabled={isPending || !!lifetimeCnic} />
        )} />
        <div className="flex items-center gap-2 mt-1">
          <Controller name="lifetimeCnic" control={control} render={({ field }) => (
            <Switch id="lifetimeCnic" checked={!!field.value} onCheckedChange={field.onChange} />
          )} />
          <label htmlFor="lifetimeCnic" className="text-sm cursor-pointer">Lifetime CNIC</label>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Joining Date</Label>
        <Controller name="joiningDate" control={control} render={({ field }) => (
          <DatePicker value={field.value as string | undefined} onChange={field.onChange} disabled={isPending} />
        )} />
        {errors?.joiningDate && <p className="text-xs text-red-500">{errors.joiningDate.message}</p>}

      </div>

      <div className="space-y-2">
        <Label>Nationality <span className="text-destructive">*</span></Label>
        <Controller name="nationality" control={control} render={({ field }) => (
          <Select value={field.value as string | undefined} onValueChange={field.onChange} disabled={isPending}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{nationalities.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}</SelectContent>
          </Select>
        )} />
        {errors?.nationality && <p className="text-xs text-red-500">{errors.nationality.message}</p>}
      </div>



      <div className="space-y-2">
        <Label>Gender <span className="text-destructive">*</span></Label>
        <Controller name="gender" control={control} render={({ field }) => (
          <Select value={field.value as string | undefined} onValueChange={field.onChange} disabled={isPending}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{genders.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}</SelectContent>
          </Select>
        )} />
        {errors?.gender && <p className="text-xs text-red-500">{errors.gender.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Date of Birth</Label>
        <Controller name="dateOfBirth" control={control} render={({ field }) => (
          <DatePicker value={field.value as string | undefined} onChange={field.onChange} disabled={isPending} />
        )} />
        {errors?.dateOfBirth && <p className="text-xs text-red-500">{errors.dateOfBirth.message}</p>}
      </div>

      <div className="col-span-1 md:col-span-3 text-lg font-bold text-muted-foreground border-b border-muted-foreground pb-2">
        Contact
      </div>

      <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label>Contact Number <span className="text-destructive">*</span></Label>
          <Controller name="contactNumber" control={control} render={({ field }) => (
            <Input
              placeholder="03XX-XXXXXXX"
              value={(field.value as string | undefined) || ""}
              onChange={(e) => field.onChange(formatPhone(e.target.value))}
              maxLength={12}
              disabled={isPending}
            />
          )} />
          {errors?.contactNumber && <p className="text-xs text-red-500">{errors.contactNumber.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact Number</Label>
          <Controller name="emergencyContactNumber" control={control} render={({ field }) => (
            <Input
              placeholder="0XXX-XXXXXXX"
              value={(field.value as string | undefined) || ""}
              onChange={(e) => field.onChange(formatPhone(e.target.value))}
              maxLength={12}
              disabled={isPending}
            />
          )} />
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact Person Name</Label>
          <Input placeholder="(eg Jane Doe)" {...register("emergencyContactPersonName")} disabled={isPending} />
        </div>
        <div className="space-y-2">
          <Label>Personal Email</Label>
          <Input placeholder="(eg jone@gmail.com)" type="email" {...register("personalEmail")} disabled={isPending} />
        </div>
        <div className="space-y-2">
          <Label>Official Email</Label>
          <Input placeholder="(eg jone@gmail.com)" type="email" {...register("officialEmail")} disabled={isPending} />
          {errors?.officialEmail && <p className="text-xs text-red-500">{errors.officialEmail.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>State <span className="text-destructive">*</span></Label>
          <Controller name="state" control={control} render={({ field }) => (
            <Autocomplete options={states.map((s) => ({ value: s.id, label: s.name }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder="Select State" disabled={isPending || loadingData} />
          )} />
          {errors?.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>City <span className="text-destructive">*</span></Label>
          <Controller name="city" control={control} render={({ field }) => (
            <Autocomplete options={cities.map((c) => ({ value: c.id, label: c.name }))} value={field.value as string | undefined} onValueChange={field.onChange} placeholder={state ? "Select City" : "Select State first"} disabled={isPending || !state || loadingData || loadingCities} isLoading={loadingCities} />
          )} />
          {errors?.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
        </div>
      </div>


      <div className="col-span-1 md:col-span-3 text-lg font-bold text-muted-foreground border-b border-muted-foreground pb-2">
        Compensation & Policies
      </div>

      <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label>
            Employee Salary (Compensation) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            placeholder="Enter employee salary"
            {...register("employeeSalary")}
            disabled={isPending}
          />
          {errors?.employeeSalary && (
            <p className="text-xs text-red-500">{errors.employeeSalary.message}</p>
          )}
        </div>


        <div className="space-y-2">
          <Label>Days Off</Label>
          <Controller name="daysOff" control={control} render={({ field }) => (
            <Select value={field.value as string | undefined} onValueChange={field.onChange} disabled={isPending}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{daysOff.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent>
            </Select>
          )} />
        </div>


        <div className="space-y-2">
          <Label>
            Reporting Manager
          </Label>

          <Controller
            name="reportingManager"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.employeeName} (${emp.employeeId})`,
                }))}
                value={field.value as string | undefined}
                onValueChange={field.onChange}
                placeholder="Select Reporting Manager"
                searchPlaceholder="Search employee..."
                emptyMessage="No employees found."
                disabled={isPending || loadingData}
                isLoading={loadingData}
              />
            )}
          />

          {errors?.reportingManager && (
            <p className="text-xs text-destructive">
              {errors.reportingManager.message}
            </p>
          )}
        </div>



        <div className="space-y-2">
          <Label>Working Hours Policy <span className="text-destructive">*</span></Label>
          <Controller name="workingHoursPolicy" control={control} render={({ field }) => (
            <Autocomplete
              options={workingHoursPolicies.map((p) => ({ value: p.id, label: `${p.name}${p.isDefault ? " (Default)" : ""}` }))}
              value={field.value as string | undefined}
              onValueChange={field.onChange}
              placeholder="Select Working Hours Policy"
              disabled={isPending || loadingData}
            />
          )} />
          {errors?.workingHoursPolicy && <p className="text-xs text-red-500">{errors.workingHoursPolicy.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Controller name="location" control={control} render={({ field }) => (
            <Autocomplete
              options={locations.map((b) => ({ value: b.id, label: `${b.name}${b.isDefault ? " (Default)" : ""}` }))}
              value={field.value as string | undefined}
              onValueChange={field.onChange}
              placeholder="Select Location (Optional)"
              disabled={isPending || loadingData}
            />
          )} />
          {errors?.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Leaves Policy <span className="text-destructive">*</span></Label>
          <Controller name="leavesPolicy" control={control} render={({ field }) => (
            <Autocomplete
              options={leavesPolicies.map((policy) => ({
                value: policy.id,
                label: `${policy.name}${policy.isDefault ? " (Default)" : ""}`,
              }))}
              value={field.value as string | undefined}
              onValueChange={field.onChange}
              placeholder="Select Leave Policy"
              searchPlaceholder="Search leave policy..."
              emptyMessage="No leave policies found."
              disabled={isPending || loadingData}
              isLoading={loadingData}
            />
          )} />
          {errors?.leavesPolicy && <p className="text-xs text-red-500">{errors.leavesPolicy.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Allow Remote Attendance</Label>
          <div className="flex items-center gap-4 h-10">
            <Controller name="allowRemoteAttendance" control={control} render={({ field }) => (
              <Switch id="remote" checked={!!field.value} onCheckedChange={field.onChange} />
            )} />
            <label htmlFor="remote" className="text-sm cursor-pointer">Yes</label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>EOBI</Label>
          <div className="flex items-center gap-4 h-10">
            <Controller name="eobi" control={control} render={({ field }) => (
              <Switch id="eobi" checked={!!field.value} onCheckedChange={field.onChange} />
            )} />
            <label htmlFor="eobi" className="text-sm cursor-pointer">Applicable</label>
          </div>
        </div>
        {isEobi ? (
          <>
            <div className="space-y-2">
              <Label>EOBI ID</Label>
              <Input placeholder="0800B656361" {...register("eobiId")} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>EOBI Code</Label>
              <Input placeholder="AA001" {...register("eobiCode")} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>EOBI Document</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  handleFileChange("eobi", file);
                }}
                disabled={isPending}
                className="cursor-pointer"
              />
              {documents.eobi && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {documents.eobi.name}
                </p>
              )}
              {(() => {
                console.log('🔍 EOBI Document Debug:', {
                  documentUrls,
                  'documentUrls.eobi': documentUrls?.eobi,
                  'documents.eobi': documents.eobi,
                  shouldShow: documentUrls?.eobi && !documents.eobi
                });
                return null;
              })()}
              {documentUrls?.eobi && !documents.eobi && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                  <a
                    href={documentUrls.eobi}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 dark:text-green-400 hover:underline flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    View Uploaded Document
                  </a>
                </div>
              )}
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label>Provident Fund</Label>
          <div className="flex items-center gap-4 h-10">
            <Controller name="providentFund" control={control} render={({ field }) => (
              <Switch id="pf" checked={!!field.value} onCheckedChange={field.onChange} />
            )} />
            <label htmlFor="pf" className="text-sm cursor-pointer">Applicable</label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Overtime Applicable</Label>
          <div className="flex items-center gap-4 h-10">
            <Controller name="overtimeApplicable" control={control} render={({ field }) => (
              <Switch id="ot" checked={!!field.value} onCheckedChange={field.onChange} />
            )} />
            <label htmlFor="ot" className="text-sm cursor-pointer">Yes</label>
          </div>
        </div>
      </div>
    </div>
  );
}
