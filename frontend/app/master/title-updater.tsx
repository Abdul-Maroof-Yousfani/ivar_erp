"use client";

// Re-export the general TitleUpdater for the master section.
// The general component automatically resolves titles from menu data,
// so no manual route maps are needed here.
export { TitleUpdater as MasterTitleUpdater } from "@/components/common/title-updater";
