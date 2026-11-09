import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function FormCard({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
      )}
      <CardContent className="p-4">{children}</CardContent>
      {footer && (
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
          {footer}
        </div>
      )}
    </Card>
  );
}

export function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 py-3 border-b border-border last:border-b-0 items-start">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
