import { useState, useEffect, useCallback, useRef } from "react";

export function usePersistentForm<T extends Record<string, string>>(
  key: string,
  defaultValues: T
) {
  const [form, setForm] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`draft_${key}`);
      if (saved) return { ...defaultValues, ...JSON.parse(saved) };
    } catch {}
    return defaultValues;
  });

  const [hasDraft, setHasDraft] = useState(() => {
    try {
      return !!localStorage.getItem(`draft_${key}`);
    } catch {
      return false;
    }
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Debounce saves
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const hasValues = Object.entries(form).some(
        ([k, v]) => v !== "" && v !== defaultValues[k]
      );
      if (hasValues) {
        localStorage.setItem(`draft_${key}`, JSON.stringify(form));
        setHasDraft(true);
      } else {
        localStorage.removeItem(`draft_${key}`);
        setHasDraft(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [form, key, defaultValues]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(`draft_${key}`);
    setHasDraft(false);
    setForm(defaultValues);
  }, [key, defaultValues]);

  return { form, setForm, hasDraft, clearDraft };
}
