"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useCallback, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Country, State, createCities, getStatesByCountry } from "@/lib/actions/city";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

interface CityAddFormProps {
  countries: Country[];
  defaultCountryId?: string;
}

export function CityAddForm({ countries, defaultCountryId }: CityAddFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState([
    { id: 1, name: "", countryId: defaultCountryId || "", stateId: "" },
  ]);
  const [statesMap, setStatesMap] = useState<Map<string, State[]>>(new Map());
  const [loadingStates, setLoadingStates] = useState<Map<string, boolean>>(new Map());

  const addRow = useCallback(() => {
    setRows((prevRows) => {
      const lastRow = prevRows[prevRows.length - 1];
      const newRowId = Date.now();
      const newRow = {
        id: newRowId,
        name: "",
        countryId: lastRow?.countryId || defaultCountryId || "",
        stateId: lastRow?.stateId || "",
      };
      
      // If the new row has a country, ensure states are loaded
      if (newRow.countryId) {
        setStatesMap((prevStatesMap) => {
          if (!prevStatesMap.has(newRow.countryId)) {
            // Load states asynchronously
            setLoadingStates((prev) => new Map(prev).set(newRow.countryId, true));
            getStatesByCountry(newRow.countryId)
              .then((result) => {
                if (result.status && result.data) {
                  setStatesMap((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(newRow.countryId, result.data!);
                    return newMap;
                  });
                }
              })
              .catch((error) => {
                console.error("Error loading states:", error);
                toast.error("Failed to load states");
              })
              .finally(() => {
                setLoadingStates((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(newRow.countryId, false);
                  return newMap;
                });
              });
          }
          return prevStatesMap;
        });
      }
      
      return [...prevRows, newRow];
    });
  }, [defaultCountryId]);


  // Load states when country changes
  const handleCountryChange = async (rowId: number, countryId: string) => {
    updateRow(rowId, "countryId", countryId);
    updateRow(rowId, "stateId", ""); // Reset state when country changes
    console.log("countryId", countryId);
    console.log("rowId", rowId);
    console.log(statesMap)
    if (!countryId) {
      return;
    }

    // Check if states are already loaded
    if (statesMap.has(countryId)) {
      return;
    }

    // Set loading state
    setLoadingStates(prev => new Map(prev).set(countryId, true));

    try {
      const result = await getStatesByCountry(countryId);
      if (result.status && result.data) {
        setStatesMap(prev => new Map(prev).set(countryId, result.data!));
      }
    } catch (error) {
      console.error("Error loading states:", error);
      toast.error("Failed to load states");
    } finally {
      setLoadingStates(prev => new Map(prev).set(countryId, false));
    }
  };

  const getStateOptions = (countryId: string) => {
    const states = statesMap.get(countryId) || [];
    return states.map((state) => ({
      value: state.id,
      label: state.name,
    }));
  };

  const removeRow = (id: number) => {
    setRows((prevRows) => {
      if (prevRows.length > 1) {
        return prevRows.filter((r) => r.id !== id);
      }
      return prevRows;
    });
  };

  const updateRow = (id: number, field: string, value: string) => {
    setRows((prevRows) =>
      prevRows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.name.trim() && r.countryId && r.stateId);

    if (validRows.length === 0) {
      toast.error("Please enter at least one city with country and state selected");
      return;
    }

    startTransition(async () => {
      const result = await createCities(
        validRows.map((r) => ({
          name: r.name.trim(),
          countryId: r.countryId,
          stateId: r.stateId,
        }))
      );
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/city/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/city/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Cities</CardTitle>
          <CardDescription>
            Create one or more cities with coordinates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Select countire</Label>
              {rows.map((row, index) => {
                const stateOptions = getStateOptions(row.countryId);
                const isLoadingStates = row.countryId ? loadingStates.get(row.countryId) || false : false;
                const countryOptions = countries.map((c) => ({
                  value: c.id,
                  label: c.nicename || c.name || "Unknown",
                }));
                return (
                  <div key={row.id} className="flex gap-2 items-end">
                    <Autocomplete
                      options={countryOptions}
                      value={row.countryId}
                      onValueChange={(value) => handleCountryChange(row.id, value)}
                      placeholder="Select country..."
                      searchPlaceholder="Search country..."
                      disabled={isPending}
                      emptyMessage={countries.length === 0 ? "No countries available" : "No countries found"}
                      className="w-[180px]"
                    />
                    <Autocomplete
                      options={stateOptions}
                      value={row.stateId}
                      onValueChange={(value) => updateRow(row.id, "stateId", value)}
                      placeholder="Select state..."
                      searchPlaceholder="Search state..."
                      disabled={isPending || !row.countryId}
                      isLoading={isLoadingStates}
                      emptyMessage={!row.countryId ? "Please select a country first" : "No states found"}
                      className="w-[180px]"
                    />
                    <Input
                      placeholder={`City ${index + 1}`}
                      value={row.name}
                      onChange={(e) => updateRow(row.id, "name", e.target.value)}
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1 || isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create {rows.length > 1 ? `${rows.length} Cities` : "City"}
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
                title="Add new row (Ctrl+Enter or Alt+N)"
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

