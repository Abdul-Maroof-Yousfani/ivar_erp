"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Users, Building2, UserCheck, ArrowRight, Plus, Trash2, LucideIcon } from "lucide-react";
import { type EmployeeDropdownOption } from "@/lib/actions/employee";
import { type Department, type SubDepartment, getSubDepartmentsByDepartment } from "@/lib/actions/department";
import { cn } from "@/lib/utils";
import { 
  updateRequestForwarding,
  type CreateApprovalLevel,
  type UpdateRequestForwardingData,
  type ApprovalLevel as ApiApprovalLevel,
} from "@/lib/actions/request-forwarding";

export type RequestType =
  | "exemption"
  | "attendance"
  | "advance-salary"
  | "loan"
  | "overtime"
  | "leave-application"
  | "leave-encashment";

export type ApprovalFlow = "auto-approved" | "multi-level";

export type ApproverType = 
  | "specific-employee" 
  | "department-head" 
  | "sub-department-head" 
  | "reporting-manager";

export type DepartmentHeadMode = "auto" | "specific";

export interface ApprovalLevel {
  level: number;
  approverType: ApproverType;
  specificEmployeeId?: string;
  departmentHeadMode?: DepartmentHeadMode;
  departmentId?: string;
  subDepartmentId?: string;
}

export interface RequestForwardingFormData {
  approvalFlow: ApprovalFlow;
  levels: ApprovalLevel[];
}

interface RequestForwardingFormProps {
  requestType: RequestType;
  formData: RequestForwardingFormData;
  onFormDataChange: (updates: Partial<RequestForwardingFormData>) => void;
  employees: EmployeeDropdownOption[];
  departments: Department[];
  loadingData: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function RequestForwardingForm({
  requestType,
  formData,
  onFormDataChange,
  employees,
  departments,
  loadingData,
  title,
  description,
  icon: Icon,
}: RequestForwardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);

  const handleApprovalFlowChange = (flow: ApprovalFlow) => {
    onFormDataChange({
      approvalFlow: flow,
      levels: flow === "auto-approved" ? [] : formData.levels.length > 0 ? formData.levels : [{ 
        level: 1, 
        approverType: "specific-employee",
        departmentHeadMode: "auto",
      }],
    });
  };

  const addApprovalLevel = () => {
    const newLevel = formData.levels.length + 1;
    onFormDataChange({
      levels: [
        ...formData.levels,
        {
          level: newLevel,
          approverType: "specific-employee",
          departmentHeadMode: "auto",
        },
      ],
    });
  };

  const removeApprovalLevel = (levelIndex: number) => {
    onFormDataChange({
      levels: formData.levels
        .filter((_, idx) => idx !== levelIndex)
        .map((level, idx) => ({ ...level, level: idx + 1 })),
    });
  };

  const updateApprovalLevel = (levelIndex: number, updates: Partial<ApprovalLevel>) => {
    onFormDataChange({
      levels: formData.levels.map((level, idx) => {
        if (idx === levelIndex) {
          const updated = { ...level, ...updates };
          // Clear dependent fields when approver type changes
          if (updates.approverType) {
            if (updates.approverType !== "specific-employee") {
              updated.specificEmployeeId = undefined;
            }
            if (updates.approverType !== "department-head" && updates.approverType !== "sub-department-head") {
              updated.departmentId = undefined;
              updated.subDepartmentId = undefined;
              updated.departmentHeadMode = undefined;
            }
            if (updates.approverType === "department-head" || updates.approverType === "sub-department-head") {
              // Set default mode to auto if not set
              if (!updated.departmentHeadMode) {
                updated.departmentHeadMode = "auto";
              }
            }
            if (updates.approverType !== "sub-department-head") {
              updated.subDepartmentId = undefined;
            }
          }
          // Clear department fields when mode changes to auto
          if (updates.departmentHeadMode === "auto") {
            updated.departmentId = undefined;
            updated.subDepartmentId = undefined;
          }
          return updated;
        }
        return level;
      }),
    });
  };

  const handleDepartmentChange = async (departmentId: string) => {
    if (!departmentId) {
      setSubDepartments([]);
      return;
    }

    try {
      const result = await getSubDepartmentsByDepartment(departmentId);
      if (result.status && result.data) {
        setSubDepartments(result.data);
      }
    } catch (error) {
      console.error("Error fetching sub-departments:", error);
    }
  };

  const validateForm = (): boolean => {
    if (formData.approvalFlow === "auto-approved") {
      return true; // Auto-approved doesn't need levels
    }

    if (formData.levels.length === 0) {
      toast.error("Please add at least one approval level");
      return false;
    }

    for (let i = 0; i < formData.levels.length; i++) {
      const level = formData.levels[i];
      
      if (level.approverType === "specific-employee" && !level.specificEmployeeId) {
        toast.error(`Level ${level.level}: Please select a specific employee`);
        return false;
      }
      
      if (level.approverType === "department-head" || level.approverType === "sub-department-head") {
        if (level.departmentHeadMode === "specific") {
          if (!level.departmentId) {
            toast.error(`Level ${level.level}: Please select a department`);
            return false;
          }
          if (level.approverType === "sub-department-head" && !level.subDepartmentId) {
            toast.error(`Level ${level.level}: Please select a sub-department`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    startTransition(async () => {
      try {
        // Transform form data to API format - only include properties that have values
        const submissionData: UpdateRequestForwardingData = {
          approvalFlow: formData.approvalFlow,
        };

        // Only include levels if multi-level flow and has levels
        if (formData.approvalFlow === "multi-level" && formData.levels.length > 0) {
          submissionData.levels = formData.levels.map((level): CreateApprovalLevel => {
            const levelData: CreateApprovalLevel = {
              level: level.level,
              approverType: level.approverType,
            };

            // Only include optional fields if they have values (not undefined)
            if (level.departmentHeadMode !== undefined) {
              levelData.departmentHeadMode = level.departmentHeadMode || null;
            }
            if (level.specificEmployeeId !== undefined) {
              levelData.specificEmployeeId = level.specificEmployeeId || null;
            }
            if (level.departmentId !== undefined) {
              levelData.departmentId = level.departmentId || null;
            }
            if (level.subDepartmentId !== undefined) {
              levelData.subDepartmentId = level.subDepartmentId || null;
            }

            return levelData;
          });
        }

        // Call the API (supports upsert - creates if doesn't exist, updates if exists)
        const result = await updateRequestForwarding(requestType, submissionData);

        if (!result.status) {
          toast.error(result.message || "Failed to save request forwarding configuration");
          return;
        }

        const requestTypeLabels: Record<RequestType, string> = {
          exemption: "Exemption",
          attendance: "Attendance",
          "advance-salary": "Advance Salary",
          loan: "Loan",
          overtime: "Overtime",
          "leave-application": "Leave Application",
          "leave-encashment": "Leave Encashment",
        };
        toast.success(
          `${requestTypeLabels[requestType]} Request Forwarding configured successfully`
        );

        // Refresh the page to get updated data from server
        router.refresh();

        // Update form data with the response if available
        if (result.data) {
          onFormDataChange({
            approvalFlow: result.data.approvalFlow as ApprovalFlow,
            levels: (result.data.approvalLevels as ApiApprovalLevel[] | undefined)?.map((level) => ({
              level: level.level,
              approverType: level.approverType as ApproverType,
              departmentHeadMode: level.departmentHeadMode as DepartmentHeadMode | undefined,
              specificEmployeeId: level.specificEmployeeId || undefined,
              departmentId: level.departmentId || undefined,
              subDepartmentId: level.subDepartmentId || undefined,
            })) || [],
          });
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to save request forwarding configuration");
      }
    });
  };

  const handleReset = () => {
    onFormDataChange({
      approvalFlow: "auto-approved",
      levels: [],
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 ">
          {/* Approval Flow Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Approval Flow <span className="text-destructive">*</span>
              </Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleApprovalFlowChange("auto-approved")}
                className={cn(
                  "relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                  formData.approvalFlow === "auto-approved"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-5 w-5",
                        formData.approvalFlow === "auto-approved" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="font-semibold">Auto Approved</span>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0",
                      formData.approvalFlow === "auto-approved"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}
                  >
                    {formData.approvalFlow === "auto-approved" && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Requests are automatically approved without manual intervention
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleApprovalFlowChange("multi-level")}
                className={cn(
                  "relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                  formData.approvalFlow === "multi-level"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Users
                      className={cn(
                        "h-5 w-5",
                        formData.approvalFlow === "multi-level" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="font-semibold">Multi Level</span>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0",
                      formData.approvalFlow === "multi-level"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}
                  >
                    {formData.approvalFlow === "multi-level" && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Requests require approval through multiple levels of hierarchy
                </p>
              </button>
            </div>
          </div>

          {/* Multi-Level Configuration */}
          {formData.approvalFlow === "multi-level" && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Approval Levels</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addApprovalLevel}
                    disabled={isPending || loadingData}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Level
                  </Button>
                </div>

                {formData.levels.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        No approval levels configured
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click Add Level to create your first approval level
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {formData.levels.map((level, levelIndex) => (
                      <Card key={levelIndex} className="relative shadow-none bg-muted/50">
                        <CardContent >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="font-semibold">
                                Level {level.level}
                              </Badge>
                              {levelIndex > 0 && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            {formData.levels.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeApprovalLevel(levelIndex)}
                                disabled={isPending}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="space-y-4">
                            {/* Approver Type */}
                            <div className="space-y-2">
                              <Label>
                                Approver Type <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                value={level.approverType}
                                onValueChange={(value) =>
                                  updateApprovalLevel(levelIndex, {
                                    approverType: value as ApproverType,
                                  })
                                }
                                disabled={isPending || loadingData}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select approver type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="specific-employee">
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="h-4 w-4" />
                                      Specific Employee
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="department-head">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      Department Head
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="sub-department-head">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      Sub-Department Head
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="reporting-manager">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4" />
                                      Reporting Manager
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Specific Employee Selection */}
                            {level.approverType === "specific-employee" && (
                              <div className="space-y-2">
                                <Label>
                                  Select Employee <span className="text-destructive">*</span>
                                </Label>
                                <Autocomplete
                                  options={employees.map((e) => ({
                                    value: e.id,
                                    label: `${e.employeeName} (${e.employeeId})`,
                                  }))}
                                  value={level.specificEmployeeId || ""}
                                  onValueChange={(value) =>
                                    updateApprovalLevel(levelIndex, {
                                      specificEmployeeId: value || undefined,
                                    })
                                  }
                                  placeholder="Search and select employee"
                                  disabled={isPending || loadingData}
                                />
                              </div>
                            )}

                            {/* Department Head Mode Selection */}
                            {(level.approverType === "department-head" ||
                              level.approverType === "sub-department-head") && (
                              <>
                                <div className="space-y-2">
                                  <Label>
                                    Forwarding Mode <span className="text-destructive">*</span>
                                  </Label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateApprovalLevel(levelIndex, {
                                          departmentHeadMode: "auto",
                                          departmentId: undefined,
                                          subDepartmentId: undefined,
                                        })
                                      }
                                      className={cn(
                                        "relative flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-all hover:bg-accent/50",
                                        level.departmentHeadMode === "auto"
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-border"
                                      )}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <span className="text-sm font-medium">Auto Forward</span>
                                        <div
                                          className={cn(
                                            "flex h-4 w-4 items-center justify-center rounded-full border-2 shrink-0",
                                            level.departmentHeadMode === "auto"
                                              ? "border-primary bg-primary"
                                              : "border-muted-foreground"
                                          )}
                                        >
                                          {level.departmentHeadMode === "auto" && (
                                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Automatically forward to the employee {level.approverType === "department-head" ? "department" : "sub-department"} head
                                      </p>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateApprovalLevel(levelIndex, {
                                          departmentHeadMode: "specific",
                                        })
                                      }
                                      className={cn(
                                        "relative flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-all hover:bg-accent/50",
                                        level.departmentHeadMode === "specific"
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-border"
                                      )}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <span className="text-sm font-medium">Specific Department</span>
                                        <div
                                          className={cn(
                                            "flex h-4 w-4 items-center justify-center rounded-full border-2 shrink-0",
                                            level.departmentHeadMode === "specific"
                                              ? "border-primary bg-primary"
                                              : "border-muted-foreground"
                                          )}
                                        >
                                          {level.departmentHeadMode === "specific" && (
                                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Forward to a specific {level.approverType === "department-head" ? "department" : "sub-department"} head
                                      </p>
                                    </button>
                                  </div>
                                </div>

                                {/* Specific Department Selection */}
                                {level.departmentHeadMode === "specific" && (
                                  <>
                                    <div className="space-y-2">
                                      <Label>
                                        Department <span className="text-destructive">*</span>
                                      </Label>
                                      <Select
                                        value={level.departmentId || ""}
                                        onValueChange={(value) => {
                                          handleDepartmentChange(value);
                                          updateApprovalLevel(levelIndex, {
                                            departmentId: value || undefined,
                                            subDepartmentId: undefined,
                                          });
                                        }}
                                        disabled={isPending || loadingData}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                              {dept.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Sub-Department Selection */}
                                    {level.approverType === "sub-department-head" && (
                                      <div className="space-y-2">
                                        <Label>
                                          Sub-Department <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                          value={level.subDepartmentId || ""}
                                          onValueChange={(value) =>
                                            updateApprovalLevel(levelIndex, {
                                              subDepartmentId: value || undefined,
                                            })
                                          }
                                          disabled={isPending || loadingData || !level.departmentId}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select sub-department" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {subDepartments
                                              .filter((sd) => sd.departmentId === level.departmentId)
                                              .map((subDept) => (
                                                <SelectItem key={subDept.id} value={subDept.id}>
                                                  {subDept.name}
                                                </SelectItem>
                                              ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Auto Mode Info */}
                                {level.departmentHeadMode === "auto" && (
                                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                                    <p>
                                      Requests will be automatically forwarded to the {level.approverType === "department-head" ? "department" : "sub-department"} head based on the requesting employee department assignment.
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Info for Reporting Manager */}
                            {level.approverType === "reporting-manager" && (
                              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                                <p>
                                  Requests will be forwarded to the employee reporting manager as specified in
                                  their profile.
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Auto-Approved Info */}
          {formData.approvalFlow === "auto-approved" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Auto Approval Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      All {requestType === "exemption" ? "exception" : requestType === "attendance" ? "attendance" : requestType === "advance-salary" ? "advance salary" : requestType === "loan" ? "loan" : requestType === "overtime" ? "overtime" : requestType === "leave-application" ? "leave application" : "leave encashment"} requests will be automatically
                      approved without requiring manual approval from any approver.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isPending}
            >
              Reset
            </Button>
            <Button type="submit" disabled={isPending || loadingData}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
