import { ReactNode } from "react";
import { PosConfigShell } from "./pos-config-shell";

export default function PosConfigLayout({ children }: { children: ReactNode }) {
    return <PosConfigShell>{children}</PosConfigShell>;
}
