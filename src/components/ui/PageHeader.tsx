import { Plus } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
      <div className="min-w-0 space-y-3">
        <h1 className="page-title text-[34px] min-[1069px]:text-[40px] font-semibold leading-[1.1] tracking-tight">{title}</h1>
        {description && (
          <p className="text-[17px] leading-[1.47] text-muted-foreground max-w-xl">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} className="shrink-0">
          {action.icon ?? <Plus className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
