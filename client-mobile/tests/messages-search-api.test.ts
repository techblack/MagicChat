import assert from "node:assert/strict"
import test from "node:test"

import type { AuthenticatedTarget } from "@/core/server-target"
import { searchClientMessages } from "@/data/search/messages-api"
import { installTestAccountRuntime } from "./auth-runtime-test-helper.ts"

const target: AuthenticatedTarget = installTestAccountRuntime({
  id: "server-1",
  url: "https://chat.example.com",
  userId: "user-1",
})

test("聊天记录搜索使用受保护目标并返回可定位消息", async () => {
  const fetcher = async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    assert.equal(url.pathname, "/api/client/search/messages")
    assert.equal(url.searchParams.get("keyword"), "发布")
    assert.equal(init?.method, "GET")
    return new Response(
      JSON.stringify({
        data: {
          items: [
            {
              conversation: {
                avatar: "",
                id: "conversation-1",
                name: "项目群",
                type: "group",
              },
              message: {
                body: { content: "发布完成", type: "text" },
                conversation_id: "conversation-1",
                created_at: "2026-08-30T00:00:00Z",
                id: "message-1",
                reactions: [],
                sender: { id: "user-2", type: "user" },
                sender_name: "小明",
                seq: 42,
                summary: "发布完成",
              },
            },
          ],
        },
        success: true,
      }),
      { headers: { "content-type": "application/json" } }
    )
  }

  const [result, empty] = await Promise.all([
    searchClientMessages(target, " 发布 ", { fetcher }),
    searchClientMessages(target, "a", { fetcher }),
  ])
  assert.equal(result[0]?.message.id, "message-1")
  assert.equal(result[0]?.message.seq, 42)
  assert.equal(result[0]?.conversation.id, "conversation-1")
  assert.deepEqual(empty, [])
})
