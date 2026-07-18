import { create } from "zustand";

import { loadPreference, savePreference } from "../session/storage";

const LANGUAGE_KEY = "sethu.language";
const ADDRESS_KEY = "sethu.selectedAddressId";
const SETHU_PLUS_KEY = "sethu.sethuPlus";

interface PreferencesState {
  /** null until hydrate() has read persisted values (so callers can wait before applying language). */
  language: string | null;
  selectedAddressId: string | null;
  /** SETHU+ membership (simulated — set by "Join SETHU+" on the Offers tab; drives checkout discount). */
  sethuPlus: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: string) => void;
  setSelectedAddressId: (id: string) => void;
  setSethuPlus: (member: boolean) => void;
}

// User preferences that outlive a session: the chosen UI language, the delivery address selected in
// the location picker, and SETHU+ membership. Persisted with the same storage as the auth token and
// hydrated on app start.
export const usePreferences = create<PreferencesState>((set) => ({
  language: null,
  selectedAddressId: null,
  sethuPlus: false,
  hydrate: async () => {
    const [language, selectedAddressId, sethuPlus] = await Promise.all([
      loadPreference(LANGUAGE_KEY),
      loadPreference(ADDRESS_KEY),
      loadPreference(SETHU_PLUS_KEY),
    ]);
    set({ language, selectedAddressId, sethuPlus: sethuPlus === "true" });
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
}));
