import type { ButtonHTMLAttributes, ReactNode } from "react";

export type FoundationButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type FoundationButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: FoundationButtonVariant;
  children: ReactNode;
};

const VARIANT_CLASS: Record<FoundationButtonVariant, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  danger: "danger-button",
  ghost: "ghost-button",
};

export function FoundationButton({ variant = "primary", className = "", children, type = "button", ...rest }: FoundationButtonProps) {
  return (
    <button type={type} className={`${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </button>
  );
}
