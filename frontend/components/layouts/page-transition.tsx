"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <ViewTransition
            key={pathname}
            enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
            exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
            default="none"
        >
            {children}
        </ViewTransition>
    );
}
