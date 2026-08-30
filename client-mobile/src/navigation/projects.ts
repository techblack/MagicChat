import type { Href } from "expo-router"

export type ProjectSection =
  | "calendar"
  | "documents"
  | "goals"
  | "members"
  | "tasks"

export function buildProjectHref(
  projectId: string,
  section?: ProjectSection
): Href {
  return {
    params: { projectId, ...(section ? { section } : {}) },
    pathname: "/(app)/office/projects/[projectId]",
  } as unknown as Href
}
