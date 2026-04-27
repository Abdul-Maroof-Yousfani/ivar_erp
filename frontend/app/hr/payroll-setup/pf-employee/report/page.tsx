import { Suspense } from "react";
import { PFReportList } from "./pf-report-list";
import { getPFReportData } from "@/lib/actions/pf-report";
import { Loader2 } from "lucide-react";

export default async function PFReportPage() {
    const result = await getPFReportData();
    const data = result.status && result.data ? result.data : [];

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                <PFReportList initialData={data} />
            </Suspense>
        </div>
    );
}
