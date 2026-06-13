import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Input, styled with the design system's `.input` class. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return <input ref={ref} className={cn("input", invalid && "err", className)} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
