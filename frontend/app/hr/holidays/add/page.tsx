"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createHoliday } from "@/lib/actions/holiday";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AddHolidayPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Use current year for date picker, but we'll normalize to base year when sending to backend
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: "",
    dateRange: {
      from: new Date(currentYear, 0, 1), // Jan 1 of current year
      to: new Date(currentYear, 0, 1), // Jan 1 of current year
    } as DateRange,
    status: "active",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Holiday name is required");
      return;
    }

    if (!formData.dateRange.from || !formData.dateRange.to) {
      toast.error("Both start date and end date are required");
      return;
    }

    // Normalize dates to current year (backend will normalize to base year 2000)
    // Extract month and day, use current year
    const fromDate = formData.dateRange.from;
    const toDate = formData.dateRange.to;
    const normalizedFrom = new Date(currentYear, fromDate.getMonth(), fromDate.getDate());
    const normalizedTo = new Date(currentYear, toDate.getMonth(), toDate.getDate());
    
    // Convert dates to ISO strings
    const dateFrom = normalizedFrom.toISOString();
    const dateTo = normalizedTo.toISOString();

    startTransition(async () => {
      const result = await createHoliday({
        name: formData.name,
        dateFrom,
        dateTo,
        status: formData.status,
      });

      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push(`/hr/holidays/list?newItemId=${result.data?.id}`);
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/hr/holidays/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Holiday</CardTitle>
          <CardDescription>
            Create a new holiday with a date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name</Label>
              <Input
                id="name"
                placeholder="e.g., Eid Holiday"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Holiday Date Range</Label>
              <DateRangePicker
                initialDateFrom={formData.dateRange.from}
                initialDateTo={formData.dateRange.to}
                showCompare={false}
                onUpdate={(values) => {
                  if (values.range) {
                    setFormData({
                      ...formData,
                      dateRange: values.range,
                    });
                  }
                }}
                dateRange={{
                  oldestDate: new Date(currentYear, 0, 1),
                  latestDate: new Date(currentYear, 11, 31),
                }}
                isPreset={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isPending}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Holiday
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  startTransition(() => {
                    addTransitionType("nav-back");
                    router.back();
                  });
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
