"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createInstitutesBulk } from "@/lib/actions/institute";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AddInstitutePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [institutes, setInstitutes] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setInstitutes([...institutes, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (institutes.length > 1) {
      setInstitutes(institutes.filter((i) => i.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setInstitutes(institutes.map((i) => (i.id === id ? { ...i, name } : i)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = institutes
      .map((i) => i.name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    
    if (items.length === 0) {
      toast.error("Please enter at least one institute name");
      return;
    }

    startTransition(async () => {
      const result = await createInstitutesBulk(items);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/institute/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/institute/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Institutes</CardTitle>
          <CardDescription>Create one or more institutes for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Institute Names</Label>
              {institutes.map((inst, index) => (
                <div key={inst.id} className="flex gap-2">
                  <Input
                    placeholder={`Institute ${index + 1}`}
                    value={inst.name}
                    onChange={(e) => updateName(inst.id, e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(inst.id)}
                    disabled={institutes.length === 1 || isPending}
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
                  Create {institutes.length > 1 ? `${institutes.length} Institutes` : "Institute"}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  startTransition(() => {
                    addTransitionType("nav-back");
                    router.back();
                  });
                }}>
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

