"use client";

import { ViewTransition } from "react";

/**
 * Wrap each page's root element with this component to get
 * directional slide animations on navigation.
 *
 * Usage in a page:
 *   import { DirectionalTransition } from "@/components/layouts/directional-transition";
 *
 *   export default function MyPage() {
 *     return (
 *       <DirectionalTransition>
 *         ...page content...
 *       </DirectionalTransition>
 *     );
 *   }
 *
 * On <Link> usage, add transitionTypes to signal direction:
 *   <Link href="/hr/attendance" transitionTypes={["nav-forward"]}>Go</Link>
 *   <Link href="/hr" transitionTypes={["nav-back"]}>Back</Link>
 */
export function DirectionalTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
