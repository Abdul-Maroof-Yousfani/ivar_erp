import { getCoupons } from "@/lib/actions/pos-config";
import { CouponsListPage } from "./coupons-list-page";

export default async function CouponsPage() {
    const res = await getCoupons();
    return <CouponsListPage coupons={res.data ?? []} />;
}
