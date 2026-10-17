import type { ReactNode } from "react";

export function GlassFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass-frame ${className}`.trim()}>{children}</div>;
}
