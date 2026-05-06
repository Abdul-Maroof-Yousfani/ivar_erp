"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createEmployeeGradesBulk } from "@/lib/actions/employee-grade";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddEmployeeGradePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [grade, setGrade] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!grade.trim()) {
      toast.error("Employee Grade is required");
      return;
    }

    startTransition(async () => {
      const result = await createEmployeeGradesBulk([{ grade: grade.trim() }]);
      if (result.status) {
        toast.success(result.message || "Employee Grade created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/employee-grade/list");
        });
      } else {
        toast.error(result.message || "Failed to create employee grade");
      }
    });
  };

  const handleCancel = () => {
    startTransition(() => {
      addTransitionType("nav-back");
      router.push("/master/employee-grade/list");
    });
  };

  return (
    <PermissionGuard permissions="employee-grade.create">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/master/employee-grade/list" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Employee Grade</CardTitle>
            <CardDescription>Create a new employee grade for your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grade">
                  Employee Grade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="grade"
                  placeholder="Enter employee grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}

