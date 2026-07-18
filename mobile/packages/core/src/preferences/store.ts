import { create } from "zustand";

import { loadPreference, savePreference } from "../session/storage";

const LANGUAGE_KEY = "sethu.language";
const ADDRESS_KEY = "sethu.selectedAddressId";
const SETHU_PLUS_KEY = "sethu.sethuPlus";
const RECENT_SEARCHES_KEY = "sethu.recentSearches";

const MAX_RECENT_SEARCHES = 6;

interface PreferencesState {
  /** null until hydrate() has read persisted values (so callers can wait before applying language). */
  language: string | null;
  selectedAddressId: string | null;
  /** SETHU+ membership (simulated — set by "Join SETHU+" on the Offers tab; drives checkout discount). */
  sethuPlus: boolean;
  /** Recent search terms (most-recent first), shown on the search screen. */
  recentSearches: string[];
  hydrate: () => Promise<void>;
  setLanguage: (language: string) => void;
  setSelectedAddressId: (id: string) => void;
  setSethuPlus: (member: boolean) => void;
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// User preferences that outlive a session: UI language, the selected delivery address, SETHU+
// membership, and recent searches. Persisted with the same storage as the auth token, hydrated on start.
export const usePreferences = create<PreferencesState>((set, get) => ({
  language: null,
  selectedAddressId: null,
  sethuPlus: false,
  recentSearches: [],
  hydrate: async () => {
    const [language, selectedAddressId, sethuPlus, recent] = await Promise.all([
      loadPreference(LANGUAGE_KEY),
      loadPreference(ADDRESS_KEY),
      loadPreference(SETHU_PLUS_KEY),
      loadPreference(RECENT_SEARCHES_KEY),
    ]);
    set({
      language,
      selectedAddressId,
      sethuPlus: sethuPlus === "true",
      recentSearches: parseRecent(recent),
    });
  },
  setLanguage: (language) => {
    set({ language });
    void savePreference(LANGUAGE_KEY, language);
  },
  setSelectedAddressId: (id) => {
    set({ selectedAddressId: id });
    void savePreference(ADDRESS_KEY, id);
  },
  setSethuPlus: (member) => {
    set({ sethuPlus: member });
    void savePreference(SETHU_PLUS_KEY, member ? "true" : "false");
  },
  addRecentSearch: (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [
      trimmed,
      ...get().recentSearches.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);
    set({ recentSearches: next });
    void savePreference(RECENT_SEARCHES_KEY, JSON.stringify(next));
  },
  clearRecentSearches: () => {
    set({ recentSearches: [] });
    void savePreference(RECENT_SEARCHES_KEY, JSON.stringify([]));
  },
}));
