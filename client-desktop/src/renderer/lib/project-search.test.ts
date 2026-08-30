import { describe, expect, it } from "vitest"

import { filterProjectGroups, filterProjectSummaries } from "./project-search"

describe("项目搜索", () => {
  const projects = [
    { description: "团队协作空间", id: "1", name: "研发计划" },
    { description: "个人记录", id: "2", name: "旅行清单" },
  ]

  it("支持项目名称和说明的拼音及首字母搜索", () => {
    expect(filterProjectSummaries(projects, "yanfa").map((project) => project.id)).toEqual(["1"])
    expect(filterProjectSummaries(projects, "研发").map((project) => project.id)).toEqual(["1"])
    expect(filterProjectSummaries(projects, "tuandui").map((project) => project.id)).toEqual(["1"])
  })

  it("搜索群聊时支持拼音并保留原有顺序", () => {
    const groups = [
      { id: "a", name: "产品讨论" },
      { id: "b", name: "研发同步" },
    ]

    expect(filterProjectGroups(groups, "tongbu").map((group) => group.id)).toEqual(["b"])
    expect(filterProjectGroups(groups, "")).toEqual(groups)
  })
})
