import type { AuthenticatedTarget } from "@/core/server-target"
import type { FriendRequest, ContactUser } from "@/core/models"
import { ApiRequestError, type ApiFetch } from "@/data/api-client"
import { createProtectedApiClient } from "@/data/protected-api-client"

type FriendRequestResponse = {
  addressee_user_id?: string
  created_at?: string
  handled_at?: string | null
  id?: string
  requester_user_id?: string
  status?: string
  updated_at?: string
}

type FriendRequestListResponse = { requests?: FriendRequestResponse[] }
type SearchUsersResponse = { user_ids?: string[] }

type RequestOptions = { fetcher?: ApiFetch; signal?: AbortSignal }

export async function searchContactUsers(
  target: AuthenticatedTarget,
  query: string,
  options: RequestOptions = {}
) {
  const data = await createProtectedApiClient(target, options.fetcher).request<SearchUsersResponse>(
    "/api/client/users/search",
    {
      body: JSON.stringify({ query: query.trim() }),
      errorMessage: "查找用户失败",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: options.signal,
    }
  )
  if (!Array.isArray(data?.user_ids) || data.user_ids.some((id) => typeof id !== "string")) {
    throw new ApiRequestError("用户查找响应格式不正确")
  }
  return data.user_ids
}

export async function listFriendRequests(
  target: AuthenticatedTarget,
  direction: "incoming" | "outgoing",
  options: RequestOptions = {}
) {
  const data = await createProtectedApiClient(target, options.fetcher).request<FriendRequestListResponse>(
    `/api/client/friend-requests?direction=${direction}`,
    { errorMessage: "加载好友申请失败", method: "GET", signal: options.signal }
  )
  if (!Array.isArray(data?.requests)) {
    throw new ApiRequestError("好友申请响应格式不正确")
  }
  return data.requests.map(normalizeFriendRequest)
}

export async function createFriendRequest(
  target: AuthenticatedTarget,
  userId: string,
  options: RequestOptions = {}
) {
  return mutateFriendRequest(target, "/api/client/friend-requests", "POST", { user_id: userId }, options)
}

export async function acceptFriendRequest(
  target: AuthenticatedTarget,
  requestId: string,
  options: RequestOptions = {}
) {
  return mutateFriendRequest(target, `/api/client/friend-requests/${encodeURIComponent(requestId)}/accept`, "POST", undefined, options)
}

export async function rejectFriendRequest(
  target: AuthenticatedTarget,
  requestId: string,
  options: RequestOptions = {}
) {
  return mutateFriendRequest(target, `/api/client/friend-requests/${encodeURIComponent(requestId)}/reject`, "POST", undefined, options)
}

export async function cancelFriendRequest(
  target: AuthenticatedTarget,
  requestId: string,
  options: RequestOptions = {}
) {
  return mutateFriendRequest(target, `/api/client/friend-requests/${encodeURIComponent(requestId)}`, "DELETE", undefined, options)
}

async function mutateFriendRequest(
  target: AuthenticatedTarget,
  path: string,
  method: "DELETE" | "POST",
  body: Record<string, string> | undefined,
  options: RequestOptions
) {
  const data = await createProtectedApiClient(target, options.fetcher).request<FriendRequestResponse>(path, {
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
    errorMessage: "好友操作失败",
    method,
    signal: options.signal,
  })
  return normalizeFriendRequest(data)
}

function normalizeFriendRequest(value: FriendRequestResponse | undefined): FriendRequest {
  if (
    !value?.id ||
    !value.requester_user_id ||
    !value.addressee_user_id ||
    !value.created_at ||
    !value.updated_at ||
    (value.status !== "pending" &&
      value.status !== "accepted" &&
      value.status !== "rejected" &&
      value.status !== "canceled")
  ) {
    throw new ApiRequestError("好友申请响应格式不正确")
  }
  return {
    addresseeUserId: value.addressee_user_id,
    createdAt: value.created_at,
    handledAt: value.handled_at ?? null,
    id: value.id,
    requesterUserId: value.requester_user_id,
    status: value.status,
    updatedAt: value.updated_at,
  }
}

export function friendRequestUserIds(
  requests: readonly FriendRequest[],
  currentUserId: string
) {
  const ids = new Set<string>()
  for (const request of requests) {
    const id = request.requesterUserId.toLocaleLowerCase() === currentUserId.toLocaleLowerCase()
      ? request.addresseeUserId
      : request.requesterUserId
    ids.add(id)
  }
  return [...ids]
}

export type FriendRequestWithUser = FriendRequest & { user: ContactUser }
