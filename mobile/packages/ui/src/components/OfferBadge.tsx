import Svg, { Path, Text as SvgText } from "react-native-svg";
import { color as tokens } from "@sethu/tokens";

// A scalloped "seal / flower" discount badge (the wavy-edged stamp on promo cards). Drawn with SVG so
// it stays crisp at any size and recolours with tokens — reuse it anywhere with <OfferBadge percent="20%" />.
export interface OfferBadgeProps {
  /** Large centred text, e.g. "20%". */
  percent: string;
  /** Small text under it (defaults to "OFF"). */
  label?: string;
  size?: number;
  /** Seal fill (defaults to brand primary). */
  fill?: string;
  /** Text colour (defaults to on-primary / white). */
  textColor?: string;
  /** Number of scallops around the edge. */
  bumps?: number;
}

// Petal/scallop outline: for each segment, bulge out to `rOuter` at the midpoint and dip to `rInner`
// at the segment ends, joined with quadratic curves → a smooth flower edge.
function scallopPath(center: number, rOuter: number, rInner: number, bumps: number): string {
  const step = (Math.PI * 2) / bumps;
  let path = "";
  for (let index = 0; index < bumps; index += 1) {
    const start = index * step;
    const mid = start + step / 2;
    const end = start + step;
    const sx = center + rInner * Math.cos(start);
    const sy = center + rInner * Math.sin(start);
    const cx = center + rOuter * Math.cos(mid);
    const cy = center + rOuter * Math.sin(mid);
    const ex = center + rInner * Math.cos(end);
    const ey = center + rInner * Math.sin(end);
    if (index === 0) path += `M ${sx} ${sy} `;
    path += `Q ${cx} ${cy} ${ex} ${ey} `;
  }
  return `${path}Z`;
}

export function OfferBadge({
  percent,
  label = "OFF",
  size = 88,
  fill = tokens.primary,
  textColor = tokens.onPrimary,
  bumps = 14,
}: OfferBadgeProps) {
  const center = size / 2;
  const rOuter = size / 2;
  const rInner = rOuter * 0.86;
  const path = scallopPath(center, rOuter, rInner, bumps);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={path} fill={fill} />
      <SvgText
        x={center}
        y={center + size * 0.04}
        fontSize={size * 0.3}
        fontFamily="Inter_800ExtraBold"
        fill={textColor}
        textAnchor="middle"
      >
        {percent}
      </SvgText>
      <SvgText
        x={center}
        y={center + size * 0.26}
        fontSize={size * 0.16}
        fontFamily="Inter_700Bold"
        fill={textColor}
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </Svg>
  );
}
