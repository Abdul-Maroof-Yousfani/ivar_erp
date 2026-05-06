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
import { createEquipments } from "@/lib/actions/equipment";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";

export default function AddEquipmentPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [equipments, setEquipments] = useState([{ id: 1, name: "" }]);

  const addRow = () => {
    setEquipments([...equipments, { id: Date.now(), name: "" }]);
  };

  const removeRow = (id: number) => {
    if (equipments.length > 1) {
      setEquipments(equipments.filter((e) => e.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setEquipments(
      equipments.map((e) => (e.id === id ? { ...e, name } : e))
    );
  };

  const handleClear = () => {
    setEquipments([{ id: 1, name: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = equipments.map((e) => ({ name: e.name.trim() })).filter((e) => e.name);

    if (items.length === 0) {
      toast.error("Please enter at least one equipment name");
      return;
    }

    startTransition(async () => {
      const result = await createEquipments(items);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/equipment/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/equipment/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Employee Equipments Form</CardTitle>
          <CardDescription>
            Add one or more equipment names for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label>Equipment Name *</Label>
              {equipments.map((item, index) => (
                <div key={item.id} className="flex gap-2">
                  <Input
                    placeholder={`Equipment ${index + 1}`}
                    value={item.name}
                    onChange={(e) => updateName(item.id, e.target.value)}
                    disabled={isPending}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(item.id)}
                    disabled={equipments.length === 1 || isPending}
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
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
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
              <Button
                type="button"
                variant="outline"
                onClick={addRow}
                disabled={isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add More Equipment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

