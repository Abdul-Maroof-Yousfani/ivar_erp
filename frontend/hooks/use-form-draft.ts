"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";

type DraftEnvelope<T> = { updatedAt: string; data: T };

export function useFormDraft<T extends FieldValues>(form: UseFormReturn<T>, key: string) {
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(key);
    } catch {
      return false;
    }
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = form.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          const envelope: DraftEnvelope<T> = {
            updatedAt: new Date().toISOString(),
            data: values as T,
          };
          localStorage.setItem(key, JSON.stringify(envelope));
          setHasDraft(true);
        } catch {}
      }, 500);
    });
    return () => sub.unsubscribe();
  }, [form, key]);

  const saveDraft = () => {
    try {
      const values = form.getValues();
      const envelope: DraftEnvelope<T> = {
        updatedAt: new Date().toISOString(),
        data: values,
      };
      localStorage.setItem(key, JSON.stringify(envelope));
      setHasDraft(true);
    } catch {}
  };

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const data = parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : parsed;
      form.reset(data as T);
      setHasDraft(true);
      return true;
    } catch {
      return false;
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(key);
      setHasDraft(false);
    } catch {}
  };

  return { hasDraft, saveDraft, loadDraft, clearDraft };
}
