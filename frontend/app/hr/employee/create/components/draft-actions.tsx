// "use client";

// import { Button } from "@/components/ui/button";

// export function DraftActions({ hasDraft, onSave, onLoad, onClear, disabled }: { hasDraft: boolean; onSave: () => void; onLoad: () => boolean; onClear: () => void; disabled?: boolean }) {
//   return (
//     <div className="flex items-center gap-2">
//       <Button variant="outline" size="sm" type="button" onClick={onSave} disabled={disabled}>Save Draft</Button>
//       <Button variant={hasDraft ? "default" : "outline"} size="sm" type="button" onClick={onLoad} disabled={disabled || !hasDraft}>Load Draft</Button>
//       <Button variant="destructive" size="sm" type="button" onClick={onClear} disabled={disabled || !hasDraft}>Clear Draft</Button>
//     </div>
//   );
// }

