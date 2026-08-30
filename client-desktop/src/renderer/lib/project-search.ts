import { createPinyinSearchText, normalizePinyinSearchQuery } from "@/lib/pinyin-search"

type ProjectSummaryLike = {
  name: string
  description: string
}

type ProjectGroupLike = {
  name: string
}

export function filterProjectSummaries<T extends ProjectSummaryLike>(
  projects: ReadonlyArray<T>,
  keyword: string,
): T[] {
  const normalizedKeyword = normalizePinyinSearchQuery(keyword)
  if (!normalizedKeyword) {
    return [...projects]
  }

  return projects.filter((project) =>
    createPinyinSearchText([project.name, project.description]).includes(normalizedKeyword),
  )
}

export function filterProjectGroups<T extends ProjectGroupLike>(
  groups: ReadonlyArray<T>,
  keyword: string,
): T[] {
  const normalizedKeyword = normalizePinyinSearchQuery(keyword)
  if (!normalizedKeyword) {
    return [...groups]
  }

  return groups.filter((group) => createPinyinSearchText([group.name]).includes(normalizedKeyword))
}
