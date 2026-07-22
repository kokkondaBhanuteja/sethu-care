import type { ReactNode } from "react";
import { CircleAlert, CircleCheckBig } from "lucide-react";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";

export interface EvidenceCardProps {
  title: string;
  /** The count or timestamp that satisfies the gate — or the gap, when it does not. */
  detail: string;
  isSatisfied: boolean;
  children?: ReactNode;
  /** The fix, when the gate is unsatisfied. It lives INSIDE the card on purpose. */
  action?: ReactNode;
}

/**
 * One evidence requirement. A card rather than a checklist row, because when a gate is unsatisfied
 * the fix has to live inside the same object — the shortest route out of a blocked state is the
 * action that clears it, and a checklist row has nowhere to put a "Call customer" button.
 */
export function EvidenceCard({ title, detail, isSatisfied, children, action }: EvidenceCardProps) {
  return (
    <Card tone={isSatisfied ? "tintSuccess" : "tintDanger"} density="tight">
      <div className="flex items-start gap-s2">
        <Icon
          glyph={isSatisfied ? CircleCheckBig : CircleAlert}
          size="lg"
          className={isSatisfied ? "text-success" : "text-danger"}
        />
        <div className="flex-1">
          <p className="text-emph text-text-1">{title}</p>
          <p className={isSatisfied ? "text-label text-text-2" : "text-label text-danger"}>
            {detail}
          </p>
        </div>
      </div>
      {children ? <div className="mt-s3">{children}</div> : null}
      {action ? <div className="mt-s3">{action}</div> : null}
    </Card>
  );
}
