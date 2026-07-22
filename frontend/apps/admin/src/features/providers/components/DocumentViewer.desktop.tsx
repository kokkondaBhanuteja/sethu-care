import { useState } from "react";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import type { ApplicationDocument } from "../applications.types";

const ZOOM_STEPS = [1, 1.25, 1.5, 2] as const;
const ROTATION_STEP_DEGREES = 90;
const FULL_TURN_DEGREES = 360;

export interface DocumentViewerProps {
  document: ApplicationDocument;
}

/**
 * Desktop is where documents actually get judged, so this is a real viewer rather than a
 * thumbnail: zoom, rotate, and a page large enough to read the name line the OCR verdict disputes.
 *
 * The page is DRAWN from the document's own line widths, never fetched — ruled lines stand in for
 * scanned body text and the name line is spelled the way the OCR read it, so the mismatch reported
 * underneath is checkable by eye. That adjacency is the whole argument for reviewing here.
 *
 * Built inside the feature because no shared primitive offers a document surface; see the feature
 * CLAUDE.md.
 */
export function DocumentViewer({ document }: DocumentViewerProps) {
  const { t } = useTranslation("adminProviders");
  const [zoomIndex, setZoomIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const scale = ZOOM_STEPS[zoomIndex] ?? 1;

  return (
    <div
      className="relative flex items-center justify-center overflow-auto rounded-card border border-border-subtle bg-inset p-s5"
      role="group"
      aria-label={t("review.viewerLabel")}
    >
      <article
        className="flex w-full max-w-md flex-col gap-s3 rounded-pill bg-canvas p-s5 shadow-card"
        style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
      >
        <p className="text-center text-pill uppercase tracking-wide text-text-2">
          {document.pageHeading ?? t(document.typeKey)}
        </p>
        {(document.pageLineWidths ?? []).map((width, index) => (
          <span
            key={`${document.id}-line-${index}`}
            aria-hidden
            className="block h-s2 rounded-full bg-inset"
            style={{ width: `${width}%` }}
          />
        ))}
        {document.pageNameLine ? (
          <p className="text-emph text-text-1">{document.pageNameLine}</p>
        ) : null}
      </article>

      <div className="absolute bottom-s3 right-s3 flex items-center gap-s1 rounded-pill bg-canvas p-s1 shadow-card">
        <Button
          variant="text"
          size="inline"
          aria-label={t("review.zoomOut")}
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
        >
          <Icon glyph={ZoomOut} size="nav" />
        </Button>
        <Button
          variant="text"
          size="inline"
          aria-label={t("review.zoomIn")}
          disabled={zoomIndex === ZOOM_STEPS.length - 1}
          onClick={() => setZoomIndex((current) => Math.min(ZOOM_STEPS.length - 1, current + 1))}
        >
          <Icon glyph={ZoomIn} size="nav" />
        </Button>
        <Button
          variant="text"
          size="inline"
          aria-label={t("review.rotate")}
          onClick={() =>
            setRotation((current) => (current + ROTATION_STEP_DEGREES) % FULL_TURN_DEGREES)
          }
        >
          <Icon glyph={RotateCw} size="nav" />
        </Button>
      </div>
    </div>
  );
}
