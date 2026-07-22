import { useCallback, useState } from "react";

import type { ProviderCandidate } from "./booking-actions.types";

export interface AssignFilters {
  skillMatchOnly: boolean;
  availableNowOnly: boolean;
  setSkillMatchOnly: (value: boolean) => void;
  setAvailableNowOnly: (value: boolean) => void;
  apply: (candidates: readonly ProviderCandidate[]) => readonly ProviderCandidate[];
  isNarrowed: boolean;
  clear: () => void;
}

/**
 * The two filters the design puts in the modal footer (spec §6.10). "Skill match only" defaults on:
 * sending an uncertified technician to a certified job is the expensive mistake, so relaxing it has
 * to be a deliberate act.
 */
export function useAssignFilters(): AssignFilters {
  const [skillMatchOnly, setSkillMatchOnly] = useState(true);
  const [availableNowOnly, setAvailableNowOnly] = useState(false);

  const apply = useCallback(
    (candidates: readonly ProviderCandidate[]) =>
      candidates.filter((candidate) => {
        if (skillMatchOnly && candidate.skillLabel === null) return false;
        if (availableNowOnly && candidate.availability !== "available") return false;
        return true;
      }),
    [skillMatchOnly, availableNowOnly],
  );

  const clear = useCallback(() => {
    setSkillMatchOnly(false);
    setAvailableNowOnly(false);
  }, []);

  return {
    skillMatchOnly,
    availableNowOnly,
    setSkillMatchOnly,
    setAvailableNowOnly,
    apply,
    isNarrowed: skillMatchOnly || availableNowOnly,
    clear,
  };
}
