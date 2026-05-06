import { getLocations } from "@/lib/actions/location";
import { VoucherFormPage } from "./voucher-form-page";

export default async function VoucherNewPage() {
    const locationsRes = await getLocations();
    return <VoucherFormPage locations={locationsRes.data ?? []} />;
}
