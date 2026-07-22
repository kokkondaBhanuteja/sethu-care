// @sethu/ui-web — the global shadcn-style component library. Every component: CVA variants,
// token-backed Tailwind utilities only (tokens.css), lucide icons, WCAG 2.2 AA. Add a component =
// component + story + test + this barrel, same change.
export { cn } from "./lib/cn";
export { Button, buttonVariants, type ButtonProps } from "./components/Button";
export {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  cardVariants,
  type CardProps,
  type CardHeaderProps,
} from "./components/Card";
export { StatusPill, statusPillVariants, type StatusPillProps } from "./components/StatusPill";
export { IconChip, iconChipVariants, type IconChipProps } from "./components/IconChip";
