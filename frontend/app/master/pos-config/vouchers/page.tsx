import { getVouchers } from "@/lib/actions/vouchers";
import { VouchersListPage } from "./vouchers-list-page";

export default async function VouchersPage() {
    const res = await getVouchers();
    return <VouchersListPage vouchers={res.data ?? []} />;
}
