import assert from "node:assert/strict"
import test from "node:test"

import type { AuthenticatedTarget } from "@/core/server-target"
import {
  acceptFriendRequest,
  createFriendRequest,
  friendRequestUserIds,
  listFriendRequests,
  searchContactUsers,
} from "@/data/contacts/friend-requests-api"
import { installTestAccountRuntime } from "./auth-runtime-test-helper.ts"

const target: AuthenticatedTarget = installTestAccountRuntime({
  id: "server-1",
  url: "https://chat.example.com",
  userId: "user-1",
})

const request = {
  addressee_user_id: "user-2",
  created_at: "2026-08-30T00:00:00Z",
  id: "request-1",
  requester_user_id: "user-1",
  status: "pending",
  updated_at: "2026-08-30T00:00:00Z",
}

test("好友申请 API 使用受保护目标并归一化响应", async () => {
  const fetcher = async (input: string, init?: RequestInit) => {
    assert.equal(new URL(input).pathname, "/api/client/friend-requests")
    assert.equal(init?.method, "POST")
    return new Response(JSON.stringify({ data: request, success: true }), {
      headers: { "content-type": "application/json" },
      status: 201,
    })
  }
  const result = await createFriendRequest(target, "user-2", { fetcher })
  assert.equal(result.id, "request-1")
  assert.equal(result.status, "pending")
})

test("好友申请列表、用户搜索和关联用户去重", async () => {
  const fetcher = async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    if (url.pathname === "/api/client/users/search") {
      assert.equal(init?.method, "POST")
      return new Response(JSON.stringify({ data: { user_ids: ["user-2"] }, success: true }), {
        headers: { "content-type": "application/json" },
      })
    }
    assert.equal(url.searchParams.get("direction"), "incoming")
    return new Response(JSON.stringify({ data: { requests: [request] }, success: true }), {
      headers: { "content-type": "application/json" },
    })
  }
  const [ids, requests] = await Promise.all([
    searchContactUsers(target, "user-2", { fetcher }),
    listFriendRequests(target, "incoming", { fetcher }),
  ])
  assert.deepEqual(ids, ["user-2"])
  assert.deepEqual(friendRequestUserIds(requests, "user-1"), ["user-2"])
  await acceptFriendRequest(target, "request-1", {
    fetcher: async (input, init) => {
      assert.equal(new URL(input).pathname, "/api/client/friend-requests/request-1/accept")
      assert.equal(init?.method, "POST")
      return new Response(JSON.stringify({ data: { ...request, status: "accepted" }, success: true }), {
        headers: { "content-type": "application/json" },
      })
    },
  })
})
