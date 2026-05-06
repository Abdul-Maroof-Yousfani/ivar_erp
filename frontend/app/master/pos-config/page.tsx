import { redirect } from "next/navigation";

export default function PosConfigIndexPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    // Legacy tab-based URLs redirect to the new sub-pages
    redirect("/master/pos-config/promos");
}
