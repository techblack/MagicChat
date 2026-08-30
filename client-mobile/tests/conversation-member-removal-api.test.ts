import assert from "node:assert/strict"
import test from "node:test"

import type { AuthenticatedTarget } from "@/core/server-target"
import { removeGroupConversationMember } from "@/data/conversations/conversations-api"
import { installTestAccountRuntime } from "./auth-runtime-test-helper.ts"

const target: AuthenticatedTarget = installTestAccountRuntime({
  id: "server-1",
  url: "https://chat.example.com",
  userId: "owner-1",
})

const conversation = {
  created_at: "2026-08-30T00:00:00Z",
  id: "group-1",
  member_count: 1,
  name: "产品群",
  type: "group",
}

test("移出用户成员使用默认成员路由并归一化群聊响应", async () => {
  const result = await removeGroupConversationMember(
    target,
    "group-1",
    "user-2",
    undefined,
    {
      fetcher: async (input, init) => {
        assert.equal(
          new URL(input).pathname,
          "/api/client/conversations/groups/group-1/members/user-2"
        )
        assert.equal(init?.method, "DELETE")
        return Response.json({ data: { conversation }, success: true })
      },
    }
  )

  assert.equal(result.id, "group-1")
  assert.equal(result.name, "产品群")
})

test("移出应用成员使用带类型的成员路由", async () => {
  await removeGroupConversationMember(
    target,
    "group-1",
    "app-1",
    "app",
    {
      fetcher: async (input, init) => {
        assert.equal(
          new URL(input).pathname,
          "/api/client/conversations/groups/group-1/members/app/app-1"
        )
        assert.equal(init?.method, "DELETE")
        return Response.json({ data: { conversation }, success: true })
      },
    }
  )
})
