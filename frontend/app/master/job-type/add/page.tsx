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
import { createJobTypes } from "@/lib/actions/job-type";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AddJobTypePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [jobTypes, setJobTypes] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setJobTypes([...jobTypes, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (jobTypes.length > 1) {
      setJobTypes(jobTypes.filter((j) => j.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setJobTypes(jobTypes.map((j) => (j.id === id ? { ...j, name } : j)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = jobTypes.map((j) => j.name.trim()).filter(Boolean);

    if (names.length === 0) {
      toast.error("Please enter at least one job type name");
      return;
    }

    startTransition(async () => {
      const result = await createJobTypes(names);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/job-type/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/job-type/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Job Types</CardTitle>
          <CardDescription>
            Create one or more job types for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Job Type Names</Label>
              {jobTypes.map((jt, index) => (
                <div key={jt.id} className="flex gap-2">
                  <Input
                    placeholder={`Job Type ${index + 1}`}
                    value={jt.name}
                    onChange={(e) => updateName(jt.id, e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(jt.id)}
                    disabled={jobTypes.length === 1 || isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create{" "}
                  {jobTypes.length > 1
                    ? `${jobTypes.length} Job Types`
                    : "Job Type"}
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
                >
                  Cancel
                </Button>
              </div>
              <button
                type="button"
                onClick={addRow}
                disabled={isPending}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                + Add more
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
