import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      green: "bg-emerald-100 text-emerald-800",
      orange: "bg-amber-100 text-amber-800",
      indigo: "bg-indigo-100 text-indigo-800",
      slate: "bg-slate-100 text-slate-700",
      white: "bg-white/20 text-white",
    },
  },
  defaultVariants: { variant: "slate" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
