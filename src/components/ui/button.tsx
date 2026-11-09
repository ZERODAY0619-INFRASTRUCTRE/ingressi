import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Buttons of the redesign (System.dc.html): primary (the accent fill),
 * secondary (raised panel), outline (panel with a border, for header
 * actions), ghost, danger (outlined, red label) and link. `destructive` is
 * the danger style under its shadcn name.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border border-transparent text-xs font-bold uppercase tracking-[0.06em] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/85",
        danger: "border-destructive text-destructive hover:bg-destructive/10",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline:
          "border-input bg-transparent text-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "h-11 w-11",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        data-ui-button=""
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
