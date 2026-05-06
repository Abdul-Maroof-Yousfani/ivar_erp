"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, startTransition, addTransitionType } from "react";
import DataTable, { FilterConfig } from "@/components/common/data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { columns, setCountriesStore, CityRow } from "./columns";
import { City, Country, State, deleteCities, updateCities, getStatesByCountry } from "@/lib/actions/city";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

interface CityListProps {
  initialCities: City[];
  countries: Country[];
  newItemId?: string;
}

export function CityList({ initialCities, countries, newItemId }: CityListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<
    { id: string; name: string; countryId: string; stateId: string }[]
  >([]);
  const [statesMap, setStatesMap] = useState<Map<string, State[]>>(new Map());
  const [loadingStates, setLoadingStates] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    setCountriesStore(countries);
  }, [countries]);

  const { hasPermission } = useAuth();
  const showAddAction = hasPermission("city.create");
  const canBulkEdit = hasPermission("city.update");
  const canBulkDelete = hasPermission("city.delete");

  const handleToggle = () => {
    startTransition(() => {
      addTransitionType("nav-forward");
      router.push("/master/city/add");
    });
  };

  const handleMultiDelete = (ids: string[]) => {
    startTransition(async () => {
      const result = await deleteCities(ids);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleBulkEdit = async (items: CityRow[]) => {
    const editRowsData = items.map((item) => ({
      id: item.id,
      name: item.name,
      countryId: item.countryId,
      stateId: item.stateId,
    }));
    setEditRows(editRowsData);

    // Load states for all unique countries
    const uniqueCountryIds = [...new Set(editRowsData.map(r => r.countryId).filter(Boolean))];
    for (const countryId of uniqueCountryIds) {
      if (!statesMap.has(countryId)) {
        setLoadingStates(prev => new Map(prev).set(countryId, true));
        try {
          const result = await getStatesByCountry(countryId);
          if (result.status && result.data) {
            setStatesMap(prev => new Map(prev).set(countryId, result.data!));
          }
        } catch (error) {
          console.error("Error loading states:", error);
        } finally {
          setLoadingStates(prev => new Map(prev).set(countryId, false));
        }
      }
    }

    setBulkEditOpen(true);
  };

  const handleCountryChangeInEdit = async (rowId: string, countryId: string) => {
    updateEditRow(rowId, "countryId", countryId);
    updateEditRow(rowId, "stateId", ""); // Reset state when country changes

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

  const updateEditRow = (id: string, field: string, value: string) => {
    setEditRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removeEditRow = (id: string) => {
    if (editRows.length > 1) {
      setEditRows((rows) => rows.filter((r) => r.id !== id));
    }
  };

  const handleBulkEditSubmit = async () => {
    const validRows = editRows.filter((r) => r.name.trim() && r.countryId && r.stateId);
    if (validRows.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await updateCities(validRows);
      if (result.status) {
        toast.success(result.message);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const data: CityRow[] = initialCities.map((city) => ({
    ...city,
    id: city.id.toString(),
  }));

  const countryFilter: FilterConfig = {
    key: "countryName",
    label: "Country",
    options: countries.map((c) => ({ label: c.name, value: c.name })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cities</h2>
        <p className="text-muted-foreground">Manage cities with coordinates</p>
      </div>

      <DataTable<CityRow>
        columns={columns}
        data={data}
        actionText={showAddAction ? "Add City" : undefined}
        toggleAction={showAddAction ? handleToggle : undefined}
        newItemId={newItemId}
        searchFields={[
          { key: "name", label: "Name" },
          { key: "countryName", label: "Country" },
          { key: "stateName", label: "State" },
        ]}
        filters={[countryFilter]}
        onMultiDelete={handleMultiDelete}
        onBulkEdit={handleBulkEdit}
        canBulkEdit={canBulkEdit}
        canBulkDelete={canBulkDelete}
        tableId="city-list"
      />

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Cities</DialogTitle>
            <DialogDescription>Update {editRows.length} city(ies)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {editRows.map((row, index) => {
              const stateOptions = getStateOptions(row.countryId);
              const isLoadingStates = row.countryId ? loadingStates.get(row.countryId) || false : false;
              return (
                <div key={row.id} className="flex gap-2 items-end">
                  <Autocomplete
                    options={countries.map((c) => ({
                      value: c.id,
                      label: c.nicename || c.name,
                    }))}
                    value={row.countryId}
                    onValueChange={(value) => handleCountryChangeInEdit(row.id, value)}
                    placeholder="Select country..."
                    searchPlaceholder="Search country..."
                    disabled={isPending}
                    className="w-[180px]"
                  />
                  <Autocomplete
                    options={stateOptions}
                    value={row.stateId}
                    onValueChange={(value) => updateEditRow(row.id, "stateId", value)}
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
                    onChange={(e) => updateEditRow(row.id, "name", e.target.value)}
                    disabled={isPending}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEditRow(row.id)}
                    disabled={editRows.length === 1 || isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleBulkEditSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

