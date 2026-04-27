import { getPromos, getCoupons, getAlliances } from "@/lib/actions/pos-config";
import { getLocations } from "@/lib/actions/location";
import { getVouchers } from "@/lib/actions/vouchers";
import { PosConfigPage } from "./pos-config-page";

export default async function PosConfigMasterPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const sp = await searchParams;
    const [promosRes, couponsRes, alliancesRes, locationsRes, vouchersRes] = await Promise.all([
        getPromos(),
        getCoupons(),
        getAlliances(),
        getLocations(),
        getVouchers(),
    ]);

    return (
        <PosConfigPage
            promos={promosRes.data || []}
            coupons={couponsRes.data || []}
            alliances={alliancesRes.data || []}
            locations={locationsRes.data || []}
            vouchers={vouchersRes.data || []}
            defaultTab={sp.tab}
        />
    );
}
