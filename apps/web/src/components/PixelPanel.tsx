import type { ReactNode } from "react";

export function PixelPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`pixel-panel ${className}`.trim()}>{children}</div>;
}
