import HRLayoutClient from "./layout-client";
import { PageTransition } from "@/components/layouts/page-transition";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HRLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <HRLayoutClient>
            <PageTransition>
                {children}
            </PageTransition>
        </HRLayoutClient>
    );
}
