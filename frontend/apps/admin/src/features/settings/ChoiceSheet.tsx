import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { RadioGroup, type RadioOption } from "../../components/ui/form/RadioGroup";

export interface ChoiceSheetProps<TValue extends string> {
  isOpen: boolean;
  title: string;
  options: readonly RadioOption<TValue>[];
  value: TValue;
  onSelect: (value: TValue) => void;
  onDismiss: () => void;
}

/**
 * The picker behind every settings row that shows a value and a chevron — quiet-hours edges, digest
 * delivery time, default landing tab.
 *
 * A real radio group rather than a wheel: the whole list is readable at once, arrow keys work, and
 * the choice commits on selection, because these settings save immediately like everything else on
 * the screen. The artifacts draw the row and its value but never the picker itself.
 */
export function ChoiceSheet<TValue extends string>({
  isOpen,
  title,
  options,
  value,
  onSelect,
  onDismiss,
}: ChoiceSheetProps<TValue>) {
  const { t } = useTranslation("adminShell");

  return (
    <Sheet
      isOpen={isOpen}
      title={title}
      onDismiss={onDismiss}
      footer={
        <Button variant="text" size="secondary" block onClick={onDismiss}>
          {t("actions.done")}
        </Button>
      }
    >
      <RadioGroup
        legend={title}
        value={value}
        options={options}
        onValueChange={(next) => {
          onSelect(next);
          onDismiss();
        }}
      />
    </Sheet>
  );
}
