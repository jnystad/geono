import { ReactNode } from "react";
import "./Layout.scss";

export function Row({ children }: { children: ReactNode }) {
  return <div className="row">{children}</div>;
}
