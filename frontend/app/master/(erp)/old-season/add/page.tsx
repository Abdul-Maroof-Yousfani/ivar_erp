"use client";

import { useId, useState, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { createOldSeasons } from "@/lib/actions/old-season";

export default function AddOldSeasonPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState([{ name: "", status: "active" }]);

  const addItem = () => {
    setItems([...items, { name: "", status: "active" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, key: "name" | "status", value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    setItems(next);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(item => item.name.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Please add at least one old season with a name");
      return;
    }

    startTransition(async () => {
      const result = await createOldSeasons(validItems);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/old-season/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <PermissionGuard permissions="master.old-season.create">
      <div className="p-6">
        <form onSubmit={onSubmit}>
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Add Old Seasons</CardTitle>
              <CardDescription>Add one or more old seasons in bulk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 p-4 border rounded-lg relative bg-muted/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${index}`}>Old Season Name</Label>
                      <Input
                        id={`name-${index}`}
                        placeholder="e.g. Summer 2020, Winter 2019"
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        disabled={isPending}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`status-${index}`}>Status</Label>
                      <Select
                        value={item.status}
                        onValueChange={(value) => updateItem(index, "status", value)}
                        disabled={isPending}
                      >
                        <SelectTrigger id={`status-${index}`}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => removeItem(index)}
                    disabled={isPending}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={addItem} disabled={isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </PermissionGuard>
  );
}
