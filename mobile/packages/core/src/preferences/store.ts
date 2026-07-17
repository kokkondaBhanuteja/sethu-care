import { create } from "zustand";

import { loadPreference, savePreference } from "../session/storage";

const LANGUAGE_KEY = "sethu.language";
const ADDRESS_KEY = "sethu.selectedAddressId";

interface PreferencesState {
  /** null until hydrate() has read persisted values (so callers can wait before applying language). */
  language: string | null;
  selectedAddressId: string | null;
  hydrate: () => Promise<void>;
  setLanguage: (language: string) => void;
  setSelectedAddressId: (id: string) => void;
}

// User preferences that outlive a session: the chosen UI language and the delivery address selected in
// the location picker. Persisted with the same storage as the auth token and hydrated on app start.
export const usePreferences = create<PreferencesState>((set) => ({
  language: null,
  selectedAddressId: null,
  hydrate: async () => {
    const [language, selectedAddressId] = await Promise.all([
      loadPreference(LANGUAGE_KEY),
      loadPreference(ADDRESS_KEY),
    ]);
    set({ language, selectedAddressId });
  },
  setLanguage: (language) => {
    set({ language });
    void savePreference(LANGUAGE_KEY, language);
  },
  setSelectedAddressId: (id) => {
    set({ selectedAddressId: id });
    void savePreference(ADDRESS_KEY, id);
  },
}));
