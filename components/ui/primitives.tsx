/**
 * The handful of shadcn/ui primitives this tool uses, in the house style:
 * Tailwind classes over a token set, variants through a small lookup, and
 * plain elements underneath so the markup stays accessible by default.
 *
 * They are copied in rather than imported because that is how shadcn/ui is
 * meant to be used — the components are source you own, not a dependency.
 */
import * as React from 'react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent',
  ghost: 'hover:bg-accent',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = 'default', size = 'md', ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          BUTTON_VARIANT[variant],
          BUTTON_SIZE[size],
          className,
        )}
        {...props}
      />
    );
  },
);

/* ----------------------------------------------------------------- Badge */

type BadgeTone = 'neutral' | 'green' | 'amber' | 'navy' | 'red';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  green: 'bg-lime-100 text-lime-800',
  amber: 'bg-orange-100 text-orange-800',
  navy: 'bg-blue-50 text-[#0e2d7c]',
  red: 'bg-red-100 text-red-800',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------- Segments */

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[6px] px-3.5 py-1.5 text-[13px] font-medium transition-colors',
            o.value === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
