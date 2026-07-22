import { useId, type ChangeEvent } from "react";
import { useTranslation } from "@sethu/i18n";
import { SearchInput as UiSearchInput } from "@sethu/ui-web";

export interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Taller variant, used where search is the screen's primary control. */
  prominent?: boolean;
  /** Accessible name when no visible label sits above the field. */
  label?: string;
  className?: string;
}

/**
 * Thin adapter over @sethu/ui-web SearchInput (P3 migration). Search keeps the borderless inset
 * fill of the admin design. Debouncing stays the caller's job (useDebounced), because how long to
 * wait depends on whether the query hits the server or filters in memory.
 */
export function SearchInput({
  value,
  onValueChange,
  placeholder,
  prominent = false,
  label,
  className,
}: SearchInputProps) {
  const inputId = useId();
  const { t } = useTranslation("adminShell");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onValueChange(event.target.value);
  }

  return (
    <UiSearchInput
      id={inputId}
      type="search"
      fill="inset"
      size={prominent ? "lg" : "md"}
      value={value}
      onChange={handleChange}
      onClear={() => onValueChange("")}
      clearLabel={t("actions.clear")}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      className={className}
    />
  );
}
