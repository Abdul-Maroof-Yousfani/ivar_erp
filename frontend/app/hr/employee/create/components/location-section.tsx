"use client";

import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";

type Option = { id: string; name: string };

export function LocationSection({ form, isPending, errors, states, cities, state, loadingCities, loadingData }: { form: any; isPending: boolean; errors: any; states: Option[]; cities: Option[]; state?: string; loadingCities: boolean; loadingData: boolean }) {
  const { register, control } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="space-y-2">
        <Label>Country <span className="text-destructive">*</span></Label>
        <Input {...register("country")} disabled={isPending} />
        {errors?.country && <p className="text-xs text-red-500">{errors.country.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>State <span className="text-destructive">*</span></Label>
        <Controller name="state" control={control} render={({ field }) => (
          <Autocomplete options={states.map(s => ({ value: s.id, label: s.name }))} value={field.value} onValueChange={field.onChange} placeholder="Select State" disabled={isPending || loadingData} />
        )} />
        {errors?.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>City <span className="text-destructive">*</span></Label>
        <Controller name="city" control={control} render={({ field }) => (
          <Autocomplete options={cities.map(c => ({ value: c.id, label: c.name }))} value={field.value} onValueChange={field.onChange} placeholder={state ? "Select City" : "Select State first"} disabled={isPending || !state || loadingData || loadingCities} isLoading={loadingCities} />
        )} />
        {errors?.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
      </div>
    </div>
  );
}
