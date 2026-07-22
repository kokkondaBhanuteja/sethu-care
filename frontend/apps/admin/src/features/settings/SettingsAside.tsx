import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";

export interface SettingsAsideProps {
  title: string;
  children: ReactNode;
}

/**
 * The narrow explainer that floats beside the 720px settings column on desktop (BOX 60). It answers
 * the question the locked rows raise without interrupting the list, in the space the constrained
 * column leaves over.
 */
export function SettingsAside({ title, children }: SettingsAsideProps) {
  return (
    <Card tone="surface" className="settings-aside">
      <div className="flex items-center gap-s2">
        <Icon glyph={Info} className="text-text-2" />
        <span className="text-emph text-text-1">{title}</span>
      </div>
      <p className="mt-s2 text-label text-text-2">{children}</p>
    </Card>
  );
}
