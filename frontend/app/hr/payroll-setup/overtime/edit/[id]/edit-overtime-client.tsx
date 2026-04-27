"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { EmployeeDropdownOption } from "@/lib/actions/employee";
import type { Department } from "@/lib/actions/department";
import {
  updateOvertimeRequest,
  type OvertimeType,
  type OvertimeRequest,
} from "@/lib/actions/overtime";
import { OvertimeForm } from "@/components/overtime/overtime-form";

interface EditOvertimeClientProps {
  initialData: OvertimeRequest;
  initialEmployees: EmployeeDropdownOption[];
  initialDepartments: Department[];
}

export function EditOvertimeClient({
  initialData,
  initialEmployees,
  initialDepartments,
}: EditOvertimeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (data: {
    employeeId: string;
    overtimeType: OvertimeType;
    title: string;
    description: string;
    date: string;
    weekdayOvertimeHours: number;
    holidayOvertimeHours: number;
  }) => {
    startTransition(async () => {
      try {
        const result = await updateOvertimeRequest(initialData.id, {
          employeeId: data.employeeId,
          overtimeType: data.overtimeType,
          title: data.title,
          description: data.description,
          date: data.date,
          weekdayOvertimeHours: data.weekdayOvertimeHours,
          holidayOvertimeHours: data.holidayOvertimeHours,
        });

        if (result.status) {
          toast.success(result.message || "Overtime request updated successfully");
          router.push("/hr/payroll-setup/overtime/view");
        } else {
          toast.error(result.message || "Failed to update overtime request");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to update overtime request");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/overtime/view">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <OvertimeForm
        mode="edit"
        initialData={initialData}
        initialEmployees={initialEmployees}
        initialDepartments={initialDepartments}
        onSubmit={handleSubmit}
        isPending={isPending}
      />
    </div>
  );
}

