export const dynamic = 'force-dynamic';
export const revalidate = 0;

import ErpLayoutClient from "./layout-client";
import { PageTransition } from "@/components/layouts/page-transition";

export default function ErpLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ErpLayoutClient>
            <PageTransition>
                {children}
            </PageTransition>
        </ErpLayoutClient>
    );
}
