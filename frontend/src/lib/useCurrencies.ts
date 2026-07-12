"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

const DEFAULT_CURRENCIES = ["INR", "USD", "AED", "EUR"];

/** Settings → Templates & Currencies lets a Super Admin edit this list, but nothing
 * ever read it back — every currency dropdown in the app was a separate hardcoded
 * array, so editing it there had zero effect anywhere. This is the shared source both
 * LeadForm and PropertyForm read from now. */
export function useCurrencies(): string[] {
  const [currencies, setCurrencies] = useState<string[]>(DEFAULT_CURRENCIES);
  useEffect(() => {
    api
      .get<{ data: Record<string, unknown> }>("/settings")
      .then((r) => {
        const c = r.data.currencies;
        if (Array.isArray(c) && c.length > 0) setCurrencies(c as string[]);
      })
      .catch(() => {});
  }, []);
  return currencies;
}
