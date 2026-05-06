import PosLayoutClient from "./layout-client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PosRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <PosLayoutClient>{children}</PosLayoutClient>;
}
