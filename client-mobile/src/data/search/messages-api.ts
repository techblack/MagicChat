import type { ClientMessageSearchResult } from "@/core/models"
import type { AuthenticatedTarget } from "@/core/server-target"
import { ApiRequestError, type ApiFetch } from "@/data/api-client"
import { normalizeClientMessage } from "@/data/messages/message-normalizer"
import { createProtectedApiClient } from "@/data/protected-api-client"

type SearchOptions = {
  fetcher?: ApiFetch
  signal?: AbortSignal
}

type SearchItem = {
  conversation?: {
    avatar?: string
    id?: string
    name?: string
    type?: string
  }
  message?: {
    sender_name?: string
    summary?: string
    [key: string]: unknown
  }
}

export async function searchClientMessages(
  target: AuthenticatedTarget,
  keyword: string,
  options: SearchOptions = {}
): Promise<ClientMessageSearchResult[]> {
  const query = keyword.trim()
  if (query.length < 2) return []
  const params = new URLSearchParams({ keyword: query })
  const data = await createProtectedApiClient(target, options.fetcher).request<{
    items?: SearchItem[]
  }>(`/api/client/search/messages?${params.toString()}`, {
    errorMessage: "搜索聊天记录失败",
    method: "GET",
    signal: options.signal,
  })
  if (!Array.isArray(data?.items)) {
    throw new ApiRequestError("聊天记录搜索响应格式不正确")
  }
  return data.items.map(normalizeSearchResult)
}

function normalizeSearchResult(item: SearchItem): ClientMessageSearchResult {
  const conversation = item.conversation
  const message = item.message
  if (
    !conversation?.id ||
    typeof conversation.avatar !== "string" ||
    typeof conversation.name !== "string" ||
    !isConversationType(conversation.type) ||
    !message ||
    typeof message.sender_name !== "string" ||
    typeof message.summary !== "string"
  ) {
    throw new ApiRequestError("聊天记录搜索响应格式不正确")
  }
  return {
    conversation: {
      avatar: conversation.avatar,
      id: conversation.id,
      name: conversation.name,
      type: conversation.type,
    },
    message: normalizeClientMessage(message),
    senderName: message.sender_name,
    summary: message.summary,
  }
}

function isConversationType(
  value: string | undefined
): value is ClientMessageSearchResult["conversation"]["type"] {
  return value === "app" || value === "direct" || value === "group" || value === "topic"
}
