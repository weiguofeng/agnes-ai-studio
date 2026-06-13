import { useState, useMemo } from "react";

export function useSearch<T>(items: T[], searchFields: (keyof T)[], query: string) {
  return useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => searchFields.some((field) => {
      const val = item[field];
      return typeof val === "string" && val.toLowerCase().includes(q);
    }));
  }, [items, searchFields, query]);
}

