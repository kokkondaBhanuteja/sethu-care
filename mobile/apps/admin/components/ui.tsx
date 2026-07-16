// The admin console's web design system — a small set of primitives on the shared Indigo Velvet
// tokens (the same tokens the RN apps use), styled to match the Stitch dashboard reference. Plain
// Tailwind + tokens; no component library needed.
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border border-outline-variant bg-surface-container-lowest p-lg shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-sm font-heading text-display-sm-mobile text-on-surface">{value}</p>
      {hint ? <p className="mt-sm text-label-sm text-on-surface-variant">{hint}</p> : null}
    </Card>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  info: "bg-primary/10 text-primary",
  success: "bg-tertiary-container text-on-tertiary-container",
  warning: "bg-secondary/10 text-secondary",
  danger: "bg-error-container text-on-error-container",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-sm py-1 text-label-sm font-medium ${toneClass[tone]}`}
    >
      {label}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonClass: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary:
    "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container",
  ghost: "text-primary hover:bg-primary/10",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-full px-lg text-label-md font-medium transition disabled:opacity-50 ${buttonClass[variant]}`}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-lg">
      <h1 className="font-heading text-headline-md text-on-surface">{title}</h1>
      {subtitle ? <p className="mt-1 text-body-md text-on-surface-variant">{subtitle}</p> : null}
    </div>
  );
}

export function EmptyRow({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-md py-xl text-center text-body-md text-on-surface-variant"
      >
        {message}
      </td>
    </tr>
  );
}
