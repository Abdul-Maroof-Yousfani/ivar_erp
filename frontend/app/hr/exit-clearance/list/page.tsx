import { getAllExitClearances } from "@/lib/actions/exit-clearance";
import { ExitClearanceList } from "./exit-clearance-list";

interface PageProps {
  searchParams: Promise<{ newItemId?: string }>;
}

export default async function ExitClearanceListPage({ searchParams }: PageProps) {
  const { newItemId } = await searchParams;

  try {
    const result = await getAllExitClearances();
    return (
      <ExitClearanceList
        initialData={result.data || []}
        newItemId={newItemId}
      />
    );
  } catch (error) {
    console.error("Error in ExitClearanceListPage:", error);
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load exit clearance records</p>
      </div>
    );
  }
}
