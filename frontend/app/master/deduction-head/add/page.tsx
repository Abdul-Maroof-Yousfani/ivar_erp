"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createDeductionHeadsBulk } from "@/lib/actions/deduction-head";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AddDeductionHeadPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Deduction Head is required");
      return;
    }

    startTransition(async () => {
      const result = await createDeductionHeadsBulk([{ name: name.trim() }]);
      if (result.status) {
        toast.success(result.message || "Deduction Head created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/deduction-head/list");
        });
      } else {
        toast.error(result.message || "Failed to create deduction head");
      }
    });
  };

  const handleCancel = () => {
    startTransition(() => {
      addTransitionType("nav-back");
      router.push("/master/deduction-head/list");
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/deduction-head/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Deduction Head</CardTitle>
          <CardDescription>Create a new deduction head for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Deduction Head <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter deduction head name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
  );
}

