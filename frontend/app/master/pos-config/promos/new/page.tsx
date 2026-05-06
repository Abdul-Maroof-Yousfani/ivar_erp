import { getPromoById } from "@/lib/actions/pos-config";
import { getLocations } from "@/lib/actions/location";
import { PromoFormPage } from "./promo-form-page";

export default async function PromoNewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
    const sp = await searchParams;
    const [locationsRes, promoRes] = await Promise.all([
        getLocations(),
        sp.id ? getPromoById(sp.id) : Promise.resolve({ status: true, data: undefined }),
    ]);

    return (
        <PromoFormPage
            locations={locationsRes.data ?? []}
            promo={promoRes.data}
        />
    );
}
