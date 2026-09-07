import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

const colors: Record<string, string> = {
  default: "bg-stone-100 text-stone-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export function Badge({
  className,
  color = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof colors }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[color],
        className,
      )}
      {...props}
    />
  );
}
