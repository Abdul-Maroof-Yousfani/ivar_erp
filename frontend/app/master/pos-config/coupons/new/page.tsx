import { getCouponById } from "@/lib/actions/pos-config";
import { getLocations } from "@/lib/actions/location";
import { CouponFormPage } from "./coupon-form-page";

export default async function CouponNewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
    const sp = await searchParams;
    const [locationsRes, couponRes] = await Promise.all([
        getLocations(),
        sp.id ? getCouponById(sp.id) : Promise.resolve({ status: true, data: undefined }),
    ]);

    return (
        <CouponFormPage
            locations={locationsRes.data ?? []}
            coupon={couponRes.data}
        />
    );
}
