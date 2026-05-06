"use client";

import { useState, useEffect } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQualification } from "@/lib/actions/qualification";
import { createInstitute } from "@/lib/actions/institute";
import { getCitiesByState } from "@/lib/actions/city";
import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Option = { id: string; name: string };

export function QualificationSection({
  form,
  isPending,
  loadingData,
  qualifications,
  institutes,
  states,
  cities,
  errors,
  onQualificationAdded,
  onInstituteAdded,
  handleFileChange,
  qualificationDocumentUrls,
  documentUrls,
}: {
  form: UseFormReturn<any>;
  isPending: boolean;
  loadingData: boolean;
  qualifications: Option[];
  institutes: Option[];
  states: Option[];
  cities: { id: string; name: string; stateId?: string }[];
  errors: Record<string, { message?: string }>;
  onQualificationAdded?: (qualification: { id: string; name: string }) => void;
  onInstituteAdded?: (institute: { id: string; name: string }) => void;
  handleFileChange?: (key: string, file: File | null) => Promise<void>;
  qualificationDocumentUrls?: Record<number, string>;
  documentUrls?: Record<string, string>;
}) {
  const { control, watch } = form;

  // Use field array for dynamic qualifications
  const { fields, append, remove } = useFieldArray({
    control,
    name: "qualifications",
  });

  // Initialize with one qualification if empty
  useEffect(() => {
    if (fields.length === 0) {
      append({
        qualification: "",
        instituteId: "",
        year: "",
        grade: "",
        stateId: "",
        cityId: "",
        documentUrl: "",
      });
    }
  }, [fields.length, append]);

  // Creating states
  const [isCreatingQualification, setIsCreatingQualification] = useState<Record<number, boolean>>({});
  const [isCreatingInstitute, setIsCreatingInstitute] = useState<Record<number, boolean>>({});

  // Dynamic cities loading based on state for each qualification
  const [qualificationCities, setQualificationCities] = useState<Record<number, { id: string; name: string }[]>>({});
  const [loadingQualificationCities, setLoadingQualificationCities] = useState<Record<number, boolean>>({});

  // Watch all qualification states - create a string of stateIds to properly track changes
  const watchedQualifications = watch("qualifications");
  const stateIdsString = watchedQualifications?.map((q: any, i: number) => `${i}:${q?.stateId || ''}`).join('|') || '';

  // Fetch cities when state changes for any qualification (similar to basic-info-section)
  useEffect(() => {
    if (!watchedQualifications || watchedQualifications.length === 0) {
      return;
    }

    const fetchCitiesForQualification = async (index: number, stateId: string) => {
      if (!stateId) {
        setQualificationCities((prev) => {
          const updated = { ...prev };
          updated[index] = [];
          return updated;
        });
        form.setValue(`qualifications.${index}.cityId`, "");
        setLoadingQualificationCities((prev) => ({ ...prev, [index]: false }));
        return;
      }

      try {
        // Loading state is already set before calling this function
        const result = await getCitiesByState(stateId);
        if (result.status && result.data) {
          setQualificationCities((prev) => ({
            ...prev,
            [index]: result.data || [],
          }));
        } else {
          toast.error(result.message || "Failed to load cities");
          setQualificationCities((prev) => {
            const updated = { ...prev };
            updated[index] = [];
            return updated;
          });
        }
      } catch (error) {
        console.error("Error fetching cities:", error);
        toast.error("Failed to fetch cities. Please try again.");
        setQualificationCities((prev) => {
          const updated = { ...prev };
          updated[index] = [];
          return updated;
        });
      } finally {
        setLoadingQualificationCities((prev) => ({ ...prev, [index]: false }));
      }
    };

    // Fetch cities for each qualification that has a state (with debounce like basic-info-section)
    const timers: NodeJS.Timeout[] = [];
    
    watchedQualifications.forEach((qual: any, index: number) => {
      const stateId = qual?.stateId;
      if (stateId) {
        // Set loading state immediately (like basic-info-section)
        setLoadingQualificationCities((prev) => ({ ...prev, [index]: true }));
        const timer = setTimeout(() => {
          fetchCitiesForQualification(index, stateId);
        }, 100);
        timers.push(timer);
      } else {
        // Clear cities if state is cleared
        setQualificationCities((prev) => {
          const updated = { ...prev };
          updated[index] = [];
          return updated;
        });
        form.setValue(`qualifications.${index}.cityId`, "");
        setLoadingQualificationCities((prev) => ({ ...prev, [index]: false }));
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [stateIdsString, form.setValue]);

  // Handle create qualification from search
  const handleCreateQualification = async (name: string, index: number): Promise<string | null> => {
    if (!name.trim()) return null;

    try {
      setIsCreatingQualification((prev) => ({ ...prev, [index]: true }));
      const result = await createQualification({ name: name.trim(), status: "active" });
      
      if (result.status && result.data) {
        const newQualification = { id: result.data.id, name: result.data.name };
        form.setValue(`qualifications.${index}.qualification`, newQualification.id);
        toast.success("Qualification added successfully");
        onQualificationAdded?.(newQualification);
        return newQualification.id;
      } else {
        toast.error(result.message || "Failed to add qualification");
        return null;
      }
    } catch (error) {
      toast.error("Failed to add qualification");
      console.error("Error creating qualification:", error);
      return null;
    } finally {
      setIsCreatingQualification((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Handle create institute from search
  const handleCreateInstitute = async (name: string, index: number): Promise<string | null> => {
    if (!name.trim()) return null;

    try {
      setIsCreatingInstitute((prev) => ({ ...prev, [index]: true }));
      const result = await createInstitute({ name: name.trim(), status: "active" });
      
      if (result.status && result.data) {
        const newInstitute = { id: result.data.id, name: result.data.name };
        form.setValue(`qualifications.${index}.instituteId`, newInstitute.id);
        toast.success("Institute added successfully");
        onInstituteAdded?.(newInstitute);
        return newInstitute.id;
      } else {
        toast.error(result.message || "Failed to add institute");
        return null;
      }
    } catch (error) {
      toast.error("Failed to add institute");
      console.error("Error creating institute:", error);
      return null;
    } finally {
      setIsCreatingInstitute((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Add new qualification
  const handleAddQualification = () => {
    append({
      qualification: "",
      instituteId: "",
      year: "",
      grade: "",
      stateId: "",
      cityId: "",
      documentUrl: "",
    });
  };

  // Handle qualification document upload
  const handleQualificationDocumentChange = async (index: number, file: File | null) => {
    if (handleFileChange) {
      const key = `qualification_${index}`;
      await handleFileChange(key, file);
      if (file) {
        // File upload will be handled by handleFileChange, we just need to update the form value
        // The URL will be set by handleFileChange in the parent component
      } else {
        form.setValue(`qualifications.${index}.documentUrl`, "");
      }
    }
  };

  // Remove qualification
  const handleRemoveQualification = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      // Clean up cities state for removed qualification
      setQualificationCities((prev) => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    } else {
      toast.error("At least one qualification is required");
    }
  };

  // Generate years array (from 1900 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);

  // Custom Autocomplete with create-on-search
  const CreateableAutocomplete = ({
    options,
    value,
    onValueChange,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    disabled,
    onCreateNew,
    isCreating,
  }: {
    options: { value: string; label: string }[];
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    onCreateNew?: (name: string) => Promise<string | null>;
    isCreating?: boolean;
  }) => {
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");

    const selectedOption = options.find((option) => option.value === value);
    const filteredOptions = options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    );
    const showCreateOption = searchValue.trim() && 
      !filteredOptions.some(opt => opt.label.toLowerCase() === searchValue.toLowerCase().trim());

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-input/30",
              !selectedOption && "text-muted-foreground"
            )}
            disabled={disabled || isCreating}
          >
            {isCreating ? (
              <>
                <span className="text-muted-foreground">Creating...</span>
                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
              </>
            ) : (
              <>
                {selectedOption ? selectedOption.label : placeholder}
                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder={searchPlaceholder} 
              disabled={disabled || isCreating}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {isCreating ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Creating...</span>
                </div>
              ) : (
                <>
                  {filteredOptions.length === 0 && !showCreateOption && (
                    <CommandEmpty>{emptyMessage}</CommandEmpty>
                  )}
                  <CommandGroup>
                    {filteredOptions.map((option) => {
                      const isSelected = value === option.value;
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          onSelect={() => {
                            const newValue = isSelected ? "" : option.value;
                            onValueChange?.(newValue);
                            setOpen(false);
                            setSearchValue("");
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      );
                    })}
                    {showCreateOption && onCreateNew && (
                      <CommandItem
                        value={`Create "${searchValue.trim()}"`}
                        onSelect={async () => {
                          const newId = await onCreateNew(searchValue.trim());
                          if (newId) {
                            onValueChange?.(newId);
                            setOpen(false);
                            setSearchValue("");
                          }
                        }}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create &quot;{searchValue.trim()}&quot;
                      </CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-lg font-bold text-muted-foreground border-b border-muted-foreground pb-2">
        Qualification
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const qualificationState = watch(`qualifications.${index}.stateId`);
          const citiesForThisQual = qualificationCities[index] || [];
          const loadingCitiesForThisQual = loadingQualificationCities[index] || false;

          return (
            <div key={field.id} className="p-4 border rounded-lg space-y-4 bg-muted/30 relative">
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveQualification(index)}
                  disabled={isPending}
                  className="absolute top-2 right-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              
              {fields.length > 1 && (
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Qualification {index + 1}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Qualification <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name={`qualifications.${index}.qualification`}
                    control={control}
                    render={({ field }) => (
                      <CreateableAutocomplete
                        options={qualifications.map((q) => ({
                          value: q.id,
                          label: q.name,
                        }))}
                        value={field.value as string | undefined}
                        onValueChange={field.onChange}
                        placeholder="Select or create Qualification"
                        searchPlaceholder="Search or create qualification..."
                        emptyMessage="No qualifications found"
                        disabled={isPending || loadingData}
                        onCreateNew={(name) => handleCreateQualification(name, index)}
                        isCreating={isCreatingQualification[index] || false}
                      />
                    )}
                  />
                  {(errors?.qualifications as any)?.[index]?.qualification && (
                    <p className="text-xs text-red-500">
                      {(errors.qualifications as any)[index].qualification.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Institute</Label>
                  <Controller
                    name={`qualifications.${index}.instituteId`}
                    control={control}
                    render={({ field }) => (
                      <CreateableAutocomplete
                        options={institutes.map((i) => ({
                          value: i.id,
                          label: i.name,
                        }))}
                        value={field.value as string | undefined}
                        onValueChange={field.onChange}
                        placeholder="Select or create Institute"
                        searchPlaceholder="Search or create institute..."
                        emptyMessage="No institutes found"
                        disabled={isPending || loadingData}
                        onCreateNew={(name) => handleCreateInstitute(name, index)}
                        isCreating={isCreatingInstitute[index] || false}
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Passing Year</Label>
                  <Controller
                    name={`qualifications.${index}.year`}
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => {
                          field.onChange(value ? parseInt(value) : "");
                        }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Controller
                    name={`qualifications.${index}.grade`}
                    control={control}
                    render={({ field }) => (
                      <Input
                        placeholder="e.g., A+, First Division"
                        value={field.value || ""}
                        onChange={field.onChange}
                        disabled={isPending}
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>State</Label>
                  <Controller
                    name={`qualifications.${index}.stateId`}
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={states.map((s) => ({
                          value: s.id,
                          label: s.name,
                        }))}
                        value={field.value as string | undefined}
                        onValueChange={(val) => {
                          field.onChange(val);
                          // Reset city when state changes
                          form.setValue(`qualifications.${index}.cityId`, "");
                          // Clear cities for this qualification to trigger refetch
                          setQualificationCities((prev) => {
                            const updated = { ...prev };
                            updated[index] = [];
                            return updated;
                          });
                          // Set loading state immediately when state changes
                          if (val) {
                            setLoadingQualificationCities((prev) => ({ ...prev, [index]: true }));
                          } else {
                            setLoadingQualificationCities((prev) => ({ ...prev, [index]: false }));
                          }
                        }}
                        placeholder="Select State"
                        disabled={isPending || loadingData}
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>City</Label>
                  <Controller
                    name={`qualifications.${index}.cityId`}
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={citiesForThisQual.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                        value={field.value as string | undefined}
                        onValueChange={field.onChange}
                        placeholder={
                          qualificationState
                            ? "Select City"
                            : "Select State first"
                        }
                        disabled={
                          isPending ||
                          !qualificationState ||
                          loadingData ||
                          loadingCitiesForThisQual
                        }
                        isLoading={loadingCitiesForThisQual}
                        emptyMessage="No cities available"
                      />
                    )}
                  />
                </div>
              </div>

              {/* Document Upload for this qualification */}
              <div className="space-y-2 md:col-span-2">
                <Label>Upload Degree Document</Label>
                <div className="flex justify-center">
                  <FileUpload
                    id={`qualification-document-${index}`}
                    onChange={async (files) => {
                      const file = files?.[0] || null;
                      if (handleFileChange) {
                        const key = `qualification_${index}`;
                        await handleFileChange(key, file);
                      }
                    }}
                    existingFileUrl={
                      documentUrls?.[`qualification_${index}`] ||
                      qualificationDocumentUrls?.[index] || 
                      watch(`qualifications.${index}.documentUrl`) || 
                      undefined
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddQualification}
          disabled={isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Qualification
        </Button>
      </div>
    </div>
  );
}

