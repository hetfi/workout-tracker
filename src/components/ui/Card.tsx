import { cn } from "@/lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ className, padding = "md", children, ...props }: CardProps) {
  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-white dark:bg-gray-800",
        "border border-gray-100 dark:border-gray-700",
        "shadow-sm",
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
