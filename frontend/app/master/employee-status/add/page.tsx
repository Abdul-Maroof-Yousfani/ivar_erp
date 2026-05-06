"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createEmployeeStatusesBulk } from "@/lib/actions/employee-status";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AddEmployeeStatusPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!status.trim()) {
      toast.error("Employement Status is required");
      return;
    }

    startTransition(async () => {
      const result = await createEmployeeStatusesBulk([{ status: status.trim() }]);
      if (result.status) {
        toast.success(result.message || "Employement Status created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/employee-status/list");
        });
      } else {
        toast.error(result.message || "Failed to create employement status");
      }
    });
  };

  const handleCancel = () => {
    startTransition(() => {
      addTransitionType("nav-back");
      router.push("/master/employee-status/list");
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/employee-status/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Employement Status</CardTitle>
          <CardDescription>Create a new employement status for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">
                Employement Status <span className="text-destructive">*</span>
              </Label>
              <Input
                id="status"
                placeholder="Enter employement status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

