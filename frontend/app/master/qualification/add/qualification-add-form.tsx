"use client";

import { useState, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  createQualification,
  createQualificationsBulk,
} from "@/lib/actions/qualification";

export function QualificationAddForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [qualifications, setQualifications] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setQualifications([...qualifications, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (qualifications.length > 1) {
      setQualifications(qualifications.filter((q) => q.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setQualifications(
      qualifications.map((q) => (q.id === id ? { ...q, name } : q))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = qualifications.map((q) => q.name.trim()).filter(Boolean);

    if (names.length === 0) {
      toast.error("Please enter at least one qualification name");
      return;
    }

    startTransition(async () => {
      if (names.length === 1) {
        const result = await createQualification({ name: names[0] });
        if (result.status) {
          toast.success(result.message || "Qualification created successfully");
          const newId = result.data?.id;
          startTransition(() => {
            addTransitionType("nav-back");
            router.push(
              `/master/qualification/list${
                newId ? `?newItemId=${newId}` : ""
              }`
            );
          });
        } else {
          toast.error(result.message || "Failed to create qualification");
        }
      } else {
        const items = names.map((name) => ({ name }));
        const result = await createQualificationsBulk(items);
        if (result.status) {
          toast.success(
            result.message || "Qualifications created successfully"
          );
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/master/qualification/list");
          });
        } else {
          toast.error(result.message || "Failed to create qualifications");
        }
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/qualification/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Qualifications</CardTitle>
          <CardDescription>
            Create one or more qualifications for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Qualification Names</Label>
              {qualifications.map((qual, index) => (
                <div key={qual.id} className="flex gap-2">
                  <Input
                    placeholder={`Qualification ${index + 1}`}
                    value={qual.name}
                    onChange={(e) => updateName(qual.id, e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(qual.id)}
                    disabled={qualifications.length === 1 || isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create{" "}
                  {qualifications.length > 1
                    ? `${qualifications.length} Qualifications`
                    : "Qualification"}
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
