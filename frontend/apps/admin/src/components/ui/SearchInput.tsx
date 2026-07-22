import { useId, type ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

export interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Taller 52px variant, used where search is the screen's primary control. */
  prominent?: boolean;
  /** Accessible name when no visible label sits above the field. */
  label?: string;
  className?: string;
}

/**
 * Search has no border in this design — fill alone. Debouncing is the caller's job (useDebounced),
 * because how long to wait depends on whether the query hits the server or filters in memory.
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
    <div className={cx("search", prominent && "search--52", className)}>
      <Icon glyph={Search} className="search__icon" />
      <label className="sr-only" htmlFor={inputId}>
        {label ?? placeholder}
      </label>
      <input
        id={inputId}
        type="search"
        className="grow bg-transparent border-0 outline-none text-body text-text-1"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
      />
      {value ? (
        <button
          type="button"
          className="appbar__btn"
          onClick={() => onValueChange("")}
          aria-label={t("actions.clear")}
        >
          <Icon glyph={X} />
        </button>
      ) : null}
    </div>
  );
}
