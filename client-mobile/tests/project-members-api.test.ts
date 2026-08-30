import assert from "node:assert/strict"
import test from "node:test"

import type { AuthenticatedTarget } from "@/core/server-target"
import { listProjectMembers } from "@/data/projects/project-details-api"
import { installTestAccountRuntime } from "./auth-runtime-test-helper.ts"

const target: AuthenticatedTarget = installTestAccountRuntime({
  id: "server-1",
  url: "https://chat.example.com",
  userId: "user-1",
})

test("项目成员列表支持分页并规范化成员字段", async () => {
  const requests: string[] = []
  const fetcher = async (input: string) => {
    const url = new URL(input)
    requests.push(url.toString())
    const cursor = url.searchParams.get("cursor")
    const data = cursor
      ? {
          members: [
            {
              id: "user-2",
              role: "owner",
              source_group_ids: [],
              status: "active",
            },
          ],
          next_cursor: null,
        }
      : {
          members: [
            {
              display_name: "小明",
              email: "x@example.com",
              id: "user-1",
              nickname: "明明",
              role: "member",
              source_group_ids: ["group-1"],
              status: "active",
            },
          ],
          next_cursor: "next-page",
        }
    return new Response(JSON.stringify({ data, success: true }), {
      headers: { "content-type": "application/json" },
    })
  }

  const members = await listProjectMembers(target, "project-1", { fetcher })

  assert.equal(members.length, 2)
  assert.equal(members[0]?.displayName, "小明")
  assert.deepEqual(members[0]?.sourceGroupIds, ["group-1"])
  assert.equal(members[1]?.role, "owner")
  assert.equal(new URL(requests[0]!).searchParams.get("limit"), "100")
  assert.equal(new URL(requests[1]!).searchParams.get("cursor"), "next-page")
})
