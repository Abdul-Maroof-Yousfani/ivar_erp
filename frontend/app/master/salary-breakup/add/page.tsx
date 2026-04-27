"use client";

import { useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createSalaryBreakup } from "@/lib/actions/salary-breakup";

export default function AddSalaryBreakupPage() {
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [isTaxable, setIsTaxable] = useState<string>("no");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!percent || isNaN(parseFloat(percent))) {
      toast.error("Please enter a valid percentage");
      return;
    }
    const percentage = parseFloat(percent);
    if (percentage < 0 || percentage > 100) {
      toast.error("Percentage must be between 0 and 100");
      return;
    }
    startTransition(async () => {
      const res = await createSalaryBreakup(
        name.trim(), 
        percentage, 
        isTaxable === "yes"
      );
      if (res.status) {
        toast.success("Salary breakup created successfully");
        setName("");
        setPercent("");
        setIsTaxable("no");
      } else {
        toast.error(res.message || "Failed to create salary breakup");
      }
    });
  };

  const handleClear = () => {
    setName("");
    setPercent("");
    setIsTaxable("no");
  };

  return (
    <div className="w-full px-10">
      <div className="mb-6">
        <Link href="/master/salary-breakup/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Salary Breakup</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Basic Salary, House Rent"
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Percent (%) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="e.g., 50.5"
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Is Taxable <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={isTaxable}
                  onValueChange={setIsTaxable}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit
              </Button>
              <Button type="button" variant="outline" onClick={handleClear} disabled={isPending}>
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

