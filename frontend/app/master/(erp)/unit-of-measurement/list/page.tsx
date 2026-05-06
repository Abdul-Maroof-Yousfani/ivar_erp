import { getUnitsOfMeasurement } from "@/lib/actions/unit-of-measurement";
import { UnitOfMeasurementList } from "./unit-of-measurement-list";
import { ListError } from "@/components/dashboard/list-error";
import { PermissionGuard } from "@/components/auth/permission-guard";

export const dynamic = "force-dynamic";

export default async function UnitOfMeasurementListPage({
    searchParams,
}: {
    searchParams: Promise<{ newItemId?: string }>;
}) {

    try {
        const { newItemId } = await searchParams;
        const result = await getUnitsOfMeasurement();

        if (!result.status || !result.data) {
            return (
                <ListError
                    title="Failed to load units of measurement"
                    message={result.message || "Unable to fetch units of measurement. Please check your connection and try again."}
                />
            );
        }

        return (
            <PermissionGuard permissions={["master.unit-of-measurement.read"]}>
                <UnitOfMeasurementList
                    initialUnits={result.data || []}
                    newItemId={newItemId}
                />
            </PermissionGuard>
        );
    } catch (error) {
        return (
            <ListError
                title="Failed to load units of measurement"
                message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            />
        );
    }
}
