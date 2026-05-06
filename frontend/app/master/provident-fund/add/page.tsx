"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProvidentFundsBulk } from "@/lib/actions/provident-fund";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AddProvidentFundPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Provident fund name is required");
      return;
    }

    const percentageValue = parseFloat(percentage);
    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      toast.error("Please enter a valid percentage (0-100)");
      return;
    }

    startTransition(async () => {
      const result = await createProvidentFundsBulk([{ 
        name: name.trim(), 
        percentage: percentageValue 
      }]);
      if (result.status) {
        toast.success(result.message || "Provident Fund created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/provident-fund/list");
        });
      } else {
        toast.error(result.message || "Failed to create provident fund");
      }
    });
  };

  const handleClear = () => {
    setName("");
    setPercentage("");
  };

  const handleCancel = () => {
    startTransition(() => {
      addTransitionType("nav-back");
      router.push("/master/provident-fund/list");
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/provident-fund/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Provident Fund</CardTitle>
          <CardDescription>Create a new provident fund for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Provident Fund Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter provident fund name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="percentage">
                Percentage <span className="text-destructive">*</span>
              </Label>
              <Input
                id="percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Enter percentage (0-100)"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit
              </Button>
              <Button type="button" variant="outline" onClick={handleClear} disabled={isPending}>
                Clear
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

