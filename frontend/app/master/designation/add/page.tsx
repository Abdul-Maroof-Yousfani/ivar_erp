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
import { createDesignations } from "@/lib/actions/designation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddDesignationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [designations, setDesignations] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setDesignations([...designations, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (designations.length > 1) {
      setDesignations(designations.filter((d) => d.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setDesignations(
      designations.map((d) => (d.id === id ? { ...d, name } : d))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = designations.map((d) => d.name.trim()).filter(Boolean);

    if (names.length === 0) {
      toast.error("Please enter at least one designation name");
      return;
    }

    startTransition(async () => {
      const result = await createDesignations(names);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/designation/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <PermissionGuard permissions="designation.create">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/master/designation/list" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Designations</CardTitle>
            <CardDescription>
              Create one or more designations for your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Designation Names</Label>
                {designations.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <Input
                      placeholder={`Designation ${index + 1}`}
                      value={item.name}
                      onChange={(e) => updateName(item.id, e.target.value)}
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(item.id)}
                      disabled={designations.length === 1 || isPending}
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
                    {designations.length > 1
                      ? `${designations.length} Designations`
                      : "Designation"}
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
    </PermissionGuard>
  );
}
