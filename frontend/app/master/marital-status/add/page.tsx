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
import { createMaritalStatuses } from "@/lib/actions/marital-status";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AddMaritalStatusPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [maritalStatuses, setMaritalStatuses] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setMaritalStatuses([...maritalStatuses, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (maritalStatuses.length > 1) {
      setMaritalStatuses(maritalStatuses.filter((m) => m.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setMaritalStatuses(
      maritalStatuses.map((m) => (m.id === id ? { ...m, name } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = maritalStatuses.map((m) => m.name.trim()).filter(Boolean);

    if (names.length === 0) {
      toast.error("Please enter at least one marital status name");
      return;
    }

    startTransition(async () => {
      const result = await createMaritalStatuses(names);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/marital-status/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/marital-status/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Marital Status</CardTitle>
          <CardDescription>
            Create one or more marital status options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Marital Status Names</Label>
              {maritalStatuses.map((ms, index) => (
                <div key={ms.id} className="flex gap-2">
                  <Input
                    placeholder={`Marital Status ${index + 1}`}
                    value={ms.name}
                    onChange={(e) => updateName(ms.id, e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(ms.id)}
                    disabled={maritalStatuses.length === 1 || isPending}
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
                  {maritalStatuses.length > 1
                    ? `${maritalStatuses.length} Marital Statuses`
                    : "Marital Status"}
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
