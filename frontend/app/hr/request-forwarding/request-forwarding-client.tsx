"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, DollarSign, CreditCard, Clock, Wallet } from "lucide-react";
import { RequestForwardingForm, type RequestType, type RequestForwardingFormData } from "@/components/request-forwarding/request-forwarding-form";
import { type EmployeeDropdownOption } from "@/lib/actions/employee";
import { type Department } from "@/lib/actions/department";
import { type RequestForwardingConfiguration } from "@/lib/actions/request-forwarding";
import { useAuth } from "@/components/providers/auth-provider";

interface RequestForwardingClientProps {
  employees: EmployeeDropdownOption[];
  departments: Department[];
  initialRequestType: RequestType;
  initialConfig: RequestForwardingConfiguration | null;
}

export function RequestForwardingClient({
  employees,
  departments,
  initialRequestType,
  initialConfig,
}: RequestForwardingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, isAdmin, user, loading } = useAuth();
  
  if (process.env.NODE_ENV === 'development') {
    console.log("RequestForwardingClient Debug:", {
      role: user?.role,
      isAdmin: isAdmin(),
      permissions: (user as any)?.permissions,
      rolePermissions: user?.role?.permissions,
      hasViewPermission: hasPermission("hr.request-forwarding.view"),
      hasManagePermission: hasPermission("hr.request-forwarding.manage"),
      hasOldPermission: hasPermission("request-forwarding.read")
    });
  }
  const typeParam = searchParams.get("type");
  const activeTab: RequestType =
    typeParam === "attendance" ||
    typeParam === "advance-salary" ||
    typeParam === "loan" ||
    typeParam === "leave-application" ||
    typeParam === "leave-encashment"
      ? typeParam
      : initialRequestType;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Request Forwarding</h2>
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
        <div className="h-64 w-full animate-pulse bg-muted rounded-lg" />
      </div>
    );
  }

  // Update URL when tab changes (triggers server-side refetch)
  const handleTabChange = (value: RequestType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", value);
    router.push(`/hr/request-forwarding?${params.toString()}`, { scroll: false });
  };

  // Initialize form data from server-side fetched configs
  const getInitialFormData = (config: RequestForwardingConfiguration | null): RequestForwardingFormData => {
    if (!config) {
      return {
        approvalFlow: "auto-approved",
        levels: [],
      };
    }

    return {
      approvalFlow: config.approvalFlow as "auto-approved" | "multi-level",
      levels: config.approvalLevels.map((level) => ({
        level: level.level,
        approverType: level.approverType as RequestForwardingFormData["levels"][number]["approverType"],
        departmentHeadMode: level.departmentHeadMode as "auto" | "specific" | undefined,
        specificEmployeeId: level.specificEmployeeId || undefined,
        departmentId: level.departmentId || undefined,
        subDepartmentId: level.subDepartmentId || undefined,
      })),
    };
  };

  const [formData, setFormData] = useState<RequestForwardingFormData>(() => getInitialFormData(initialConfig));
  const handleFormDataChange = useCallback((updates: Partial<RequestForwardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Tab configuration
  const allTabs = [
    {
      value: "attendance" as RequestType,
      label: "Attendance",
      icon: CheckCircle2,
      permission: "hr.request-forwarding.attendance",
      title: "Attendance Request Forwarding Configuration",
      description: "Set up approval workflows for attendance requests",
    },
    {
      value: "advance-salary" as RequestType,
      label: "Advance Salary",
      icon: DollarSign,
      permission: "hr.request-forwarding.advance-salary",
      title: "Advance Salary Request Forwarding Configuration",
      description: "Set up approval workflows for advance salary requests",
    },
    {
      value: "loan" as RequestType,
      label: "Loan",
      icon: CreditCard,
      permission: "hr.request-forwarding.loan",
      title: "Loan Request Forwarding Configuration",
      description: "Set up approval workflows for loan requests",
    },
    {
      value: "leave-application" as RequestType,
      label: "Leave",
      icon: Clock,
      permission: "hr.request-forwarding.leave-application",
      title: "Leave Application Request Forwarding Configuration",
      description: "Set up approval workflows for leave applications",
    },
    {
      value: "leave-encashment" as RequestType,
      label: "Leave Encashment",
      icon: Wallet,
      permission: "hr.request-forwarding.leave-encashment",
      title: "Leave Encashment Request Forwarding Configuration",
      description: "Set up approval workflows for leave encashment requests",
    },
  ];

  const hasAnySpecificPermission = allTabs.some(tab => hasPermission(tab.permission));
  const hasGeneralPermission = 
    hasPermission("hr.request-forwarding.view") || 
    hasPermission("hr.request-forwarding.manage") || 
    hasPermission("request-forwarding.read");

  const tabs = allTabs.filter(tab => 
    isAdmin() || 
    hasPermission(tab.permission) || 
    (!hasAnySpecificPermission && hasGeneralPermission)
  );

  // Ultimate Failsafe: If authenticated and has general permission but granular logic returned 0 tabs, show all
  const finalTabs = tabs.length > 0 ? tabs : (hasGeneralPermission ? allTabs : []);

  // Fallback to first available tab if current activeTab is not accessible
  const effectiveActiveTab = finalTabs.some(t => t.value === activeTab) 
    ? activeTab 
    : (finalTabs.length > 0 ? finalTabs[0].value : activeTab);


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Request Forwarding</h2>
        <p className="text-muted-foreground">Configure approval workflows for different request types</p>
      </div>

      <Tabs value={effectiveActiveTab} onValueChange={(v) => handleTabChange(v as RequestType)} className="w-full">
        <TabsList variant="card" className="flex w-full max-w-6xl">
          {finalTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {finalTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              {effectiveActiveTab === tab.value && (
                <RequestForwardingForm
                  requestType={tab.value}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  employees={employees}
                  departments={departments}
                  loadingData={false}
                  title={tab.title}
                  description={tab.description}
                  icon={Icon}
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
