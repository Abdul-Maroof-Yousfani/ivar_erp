"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createLocations } from "@/lib/actions/location";
import { getCities, City } from "@/lib/actions/city";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AddLocationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  interface LocationState {
    id: number;
    name: string;
    code: string;
    address: string;
    cityId: string;
  }
  const [locations, setLocations] = useState<LocationState[]>([{ id: 1, name: "", code: "", address: "", cityId: "" }]);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    async function fetchCities() {
      const result = await getCities();
      if (result.status && result.data) {
        setCities(result.data);
      }
    }
    fetchCities();
  }, []);

  const addRow = () => {
    setLocations([...locations, { id: Date.now(), name: "", code: "", address: "", cityId: "" }]);
  };

  const removeRow = (id: number) => {
    if (locations.length > 1) {
      setLocations(locations.filter((l) => l.id !== id));
    }
  };

  const updateLocation = (id: number, field: string, value: string) => {
    setLocations(locations.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLocations = locations.filter((l) => l.name.trim() && l.code.trim());

    if (validLocations.length === 0) {
      toast.error("Please enter Name and Code for at least one location");
      return;
    }

    startTransition(async () => {
      const result = await createLocations(
        validLocations.map((l) => ({
          name: l.name.trim(),
          code: l.code.trim(),
          address: l.address.trim() || undefined,
          cityId: l.cityId || undefined,
        }))
      );
      if (result.status) {
        toast.success(result.message || "Locations created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/location/list");
        });
      } else {
        toast.error(result.message || "Failed to create locations");
      }
    });
  };

  const cityOptions = cities.map((city) => ({
    value: city.id,
    label: city.name,
  }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/location/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Locations</CardTitle>
          <CardDescription>Create one or more locations with their addresses and cities</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-6">
              <Label>Locations</Label>
              {locations.map((loc, index) => (
                <div key={loc.id} className="space-y-3 p-4 border rounded-lg bg-muted/10 relative group">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 order-1 md:order-0">
                      <Label className="text-xs text-muted-foreground">Location Name</Label>
                      <Input
                        placeholder={`Location ${index + 1} Name`}
                        value={loc.name}
                        onChange={(e) => updateLocation(loc.id, "name", e.target.value)}
                        disabled={isPending}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5 order-2 md:order-0">
                      <Label className="text-xs text-muted-foreground">Location Code</Label>
                      <Input
                        placeholder="e.g. NYC-01"
                        value={loc.code}
                        onChange={(e) => updateLocation(loc.id, "code", e.target.value.toUpperCase())}
                        disabled={isPending}
                        className="bg-background"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(loc.id)}
                      disabled={locations.length === 1 || isPending}
                      className="absolute right-0 top-0 -mt-10 mr-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Address (Optional)</Label>
                      <Input
                        placeholder="Street address..."
                        value={loc.address}
                        onChange={(e) => updateLocation(loc.id, "address", e.target.value)}
                        disabled={isPending}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">City (Optional)</Label>
                      <Autocomplete
                        options={cityOptions}
                        value={loc.cityId}
                        onValueChange={(value) => updateLocation(loc.id, "cityId", value)}
                        placeholder="Select City"
                        searchPlaceholder="Search cities..."
                        disabled={isPending}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-between items-center pt-2">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create {locations.length > 1 ? `${locations.length} Locations` : "Location"}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  startTransition(() => {
                    addTransitionType("nav-back");
                    router.back();
                  });
                }} disabled={isPending}>
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
