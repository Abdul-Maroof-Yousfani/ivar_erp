"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/common/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Label } from "@/components/ui/label";
import { EllipsisIcon, Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { City, Country, State, updateCity, deleteCity, getStatesByCountry } from "@/lib/actions/city";
import { useAuth } from "@/components/providers/auth-provider";

export type CityRow = City & { id: string };

let countriesStore: Country[] = [];
export const setCountriesStore = (countries: Country[]) => {
  countriesStore = countries;
};

export const columns: ColumnDef<CityRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 28,
  },
  {
    header: "Name",
    accessorKey: "name",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />,
  },
  {
    header: "Country",
    accessorKey: "countryName",
    accessorFn: (row) => row.country?.name || "—",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.country?.name || "—"} />,
  },
  {
    header: "State",
    accessorKey: "stateName",
    accessorFn: (row) => row.state?.name || "—",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.state?.name || "—"} />,
  },
  {
    header: "Created At",
    accessorKey: "createdAt",
    size: 150,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    enableSorting: true,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

type RowActionsProps = {
  row: Row<CityRow>;
};

function RowActions({ row }: RowActionsProps) {
  const city = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [countryId, setCountryId] = useState(city.countryId);
  const [stateId, setStateId] = useState(city.stateId);

  const canEdit = isAdmin() || hasPermission("city.update");
  const canDelete = isAdmin() || hasPermission("city.delete");

  if (!canEdit && !canDelete) {
    return null;
  }
  const [states, setStates] = useState<State[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);

  useEffect(() => {
    if (editDialog && countryId) {
      loadStates(countryId);
    }
  }, [editDialog, countryId]);

  const loadStates = async (countryId: string) => {
    setLoadingStates(true);
    try {
      const result = await getStatesByCountry(countryId);
      if (result.status && result.data) {
        setStates(result.data);
      }
    } catch (error) {
      console.error("Error loading states:", error);
    } finally {
      setLoadingStates(false);
    }
  };

  const handleCountryChange = async (value: string) => {
    setCountryId(value);
    setStateId(""); // Reset state when country changes
    if (value) {
      await loadStates(value);
    } else {
      setStates([]);
    }
  };

  const handleEditSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await updateCity(city.id, formData);
      if (result.status) {
        toast.success(result.message);
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteCity(city.id);
      if (result.status) {
        toast.success(result.message);
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button size="icon" variant="ghost" className="shadow-none" aria-label="Actions">
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => {
              setEditDialog(true);
              setCountryId(city.countryId);
              setStateId(city.stateId);
              if (city.countryId) {
                loadStates(city.countryId);
              }
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit City</DialogTitle>
            <DialogDescription>Update the city details</DialogDescription>
          </DialogHeader>
          <form action={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Autocomplete
                  options={countriesStore.map((c) => ({
                    value: c.id,
                    label: c.nicename || c.name,
                  }))}
                  value={countryId}
                  onValueChange={handleCountryChange}
                  placeholder="Select country..."
                  searchPlaceholder="Search country..."
                  disabled={isPending}
                />
                <input type="hidden" name="countryId" value={countryId} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Autocomplete
                  options={states.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  value={stateId}
                  onValueChange={setStateId}
                  placeholder="Select state..."
                  searchPlaceholder="Search state..."
                  disabled={isPending || !countryId}
                  isLoading={loadingStates}
                  emptyMessage={!countryId ? "Please select a country first" : "No states found"}
                />
                <input type="hidden" name="stateId" value={stateId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">City Name</Label>
                <Input id="edit-name" name="name" defaultValue={city.name} disabled={isPending} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete City</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{city.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

