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
import { createLoanTypes } from "@/lib/actions/loan-type";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AddLoanTypePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loanTypes, setLoanTypes] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setLoanTypes([...loanTypes, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (loanTypes.length > 1) {
      setLoanTypes(loanTypes.filter((lt) => lt.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setLoanTypes(
      loanTypes.map((lt) => (lt.id === id ? { ...lt, name } : lt))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = loanTypes.map((lt) => ({ name: lt.name.trim() })).filter((lt) => lt.name);

    if (items.length === 0) {
      toast.error("Please enter at least one loan type name");
      return;
    }

    startTransition(async () => {
      const result = await createLoanTypes(items);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/loan-types/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/loan-types/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Loan Types</CardTitle>
          <CardDescription>
            Create one or more loan types for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Loan Type Names</Label>
              {loanTypes.map((item, index) => (
                <div key={item.id} className="flex gap-2">
                  <Input
                    placeholder={`Loan Type ${index + 1}`}
                    value={item.name}
                    onChange={(e) => updateName(item.id, e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(item.id)}
                    disabled={loanTypes.length === 1 || isPending}
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
                  {loanTypes.length > 1
                    ? `${loanTypes.length} Loan Types`
                    : "Loan Type"}
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
