import { ReactNode } from "react";
import "./Layout.scss";

export function Row({
  align = "center",
  wrap = false,
  children,
}: {
  align?: "top" | "center" | "bottom";
  wrap?: boolean;
  children: ReactNode;
}) {
  return <div className={`row align-${align} ${wrap ? "wrap" : ""}`}>{children}</div>;
}
