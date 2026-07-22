import type { ReactNode } from "react";

import { Switch } from "../../components/ui/form/Switch";

export interface SettingsSwitchRowProps {
  label: ReactNode;
  /** The consequence of turning it off, stated plainly under the label. */
  detail?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Marks a channel whose loss is dangerous, so the row itself warns when it is off. */
  tone?: "default" | "danger";
}

/**
 * A settings row whose whole content is a switch. The control carries its own label — that is what
 * makes the label part of the tap target and the announced name of the switch — so the row supplies
 * only the card's horizontal padding and the inset divider.
 */
export function SettingsSwitchRow({
  label,
  detail,
  checked,
  onCheckedChange,
  disabled = false,
  tone = "default",
}: SettingsSwitchRowProps) {
  return (
    <div className="border-t border-border-subtle px-s4 first:border-t-0">
      <Switch
        label={label}
        description={detail}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        tone={tone}
      />
    </div>
  );
}
