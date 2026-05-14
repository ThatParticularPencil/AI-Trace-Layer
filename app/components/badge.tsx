import { cn } from "@/app/lib/utils";

const variants = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rewritten: "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-red-200 bg-red-50 text-red-700",
  warning: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600"
};

export function Badge({
  children,
  variant = "neutral",
  className
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
