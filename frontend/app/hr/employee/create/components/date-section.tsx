"use client";

import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";

export function DateSection({ form, isPending, errors }: { form: UseFormReturn<any>; isPending: boolean; errors: Record<string, { message?: string }> }) {
  const { control } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* All date fields moved to BasicInfoSection */}
    </div>
  );
}
