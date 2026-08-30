import type {
  ClientProjectDocument,
  ClientProjectMember,
  ClientProjectTask,
} from "@/core/models"
import type { AuthenticatedTarget } from "@/core/server-target"
import { ApiRequestError, type ApiFetch } from "@/data/api-client"
import { createProtectedApiClient } from "@/data/protected-api-client"

type RequestOptions = { fetcher?: ApiFetch; signal?: AbortSignal }

type TaskResponse = {
  assignee?: { id?: string; name?: string; nickname?: string } | null
  description?: string
  due_date?: string | null
  id?: string
  priority?: number
  start_date?: string | null
  status?: string
  title?: string
}

type DocumentResponse = {
  document_type?: string | null
  id?: string
  kind?: string
  parent_id?: string | null
  title?: string
  updated_at?: string
}

type MemberResponse = {
  avatar?: string
  display_name?: string
  email?: string
  id?: string
  name?: string
  nickname?: string
  role?: string
  source_group_ids?: string[]
  status?: string
}

export async function listProjectTasks(
  target: AuthenticatedTarget,
  projectId: string,
  options: RequestOptions = {}
) {
  const tasks: ClientProjectTask[] = []
  let cursor: string | undefined
  do {
    const query = new URLSearchParams({ limit: "100" })
    if (cursor) query.set("cursor", cursor)
    const data = await createProtectedApiClient(target, options.fetcher).request<{
      next_cursor?: string | null
      tasks?: TaskResponse[]
    }>(
      `/api/client/projects/${encodeURIComponent(projectId)}/tasks?${query.toString()}`,
      {
        errorMessage: "加载任务列表失败",
        method: "GET",
        signal: options.signal,
      }
    )
    if (!Array.isArray(data?.tasks)) {
      throw new ApiRequestError("任务列表响应格式不正确")
    }
    tasks.push(...data.tasks.map(normalizeTask))
    const nextCursor = data.next_cursor ?? undefined
    if (!nextCursor || nextCursor === cursor) break
    cursor = nextCursor
  } while (true)
  return tasks
}

export async function listProjectDocuments(
  target: AuthenticatedTarget,
  projectId: string,
  options: RequestOptions = {}
) {
  const data = await createProtectedApiClient(target, options.fetcher).request<{
    documents?: DocumentResponse[]
  }>(`/api/client/projects/${encodeURIComponent(projectId)}/documents`, {
    errorMessage: "加载文档列表失败",
    method: "GET",
    signal: options.signal,
  })
  if (!Array.isArray(data?.documents)) throw new ApiRequestError("文档列表响应格式不正确")
  return data.documents.map(normalizeDocument)
}

export async function listProjectMembers(
  target: AuthenticatedTarget,
  projectId: string,
  options: RequestOptions = {}
) {
  const members: ClientProjectMember[] = []
  let cursor: string | undefined
  do {
    const query = new URLSearchParams({ limit: "100" })
    if (cursor) query.set("cursor", cursor)
    const data = await createProtectedApiClient(target, options.fetcher).request<{
      next_cursor?: string | null
      members?: MemberResponse[]
    }>(
      `/api/client/projects/${encodeURIComponent(projectId)}/members?${query.toString()}`,
      {
        errorMessage: "加载项目成员失败",
        method: "GET",
        signal: options.signal,
      }
    )
    if (!Array.isArray(data?.members)) {
      throw new ApiRequestError("项目成员响应格式不正确")
    }
    members.push(...data.members.map(normalizeMember))
    const nextCursor = data.next_cursor ?? undefined
    if (!nextCursor || nextCursor === cursor) break
    cursor = nextCursor
  } while (true)
  return members
}

function normalizeTask(value: TaskResponse): ClientProjectTask {
  if (
    !value.id ||
    !value.title ||
    (value.status !== "todo" &&
      value.status !== "in_progress" &&
      value.status !== "done" &&
      value.status !== "canceled")
  ) {
    throw new ApiRequestError("任务响应格式不正确")
  }
  const assigneeId = value.assignee?.id
  return {
    ...(assigneeId ? { assigneeId } : {}),
    assigneeName: value.assignee?.nickname || value.assignee?.name || "未指派",
    description: value.description ?? "",
    dueDate: value.due_date ?? null,
    id: value.id,
    priority: typeof value.priority === "number" ? value.priority : 2,
    startDate: value.start_date ?? null,
    status: value.status,
    title: value.title,
  }
}

function normalizeDocument(value: DocumentResponse): ClientProjectDocument {
  if (
    !value.id ||
    !value.title ||
    !value.updated_at ||
    (value.kind !== "document" && value.kind !== "folder") ||
    (value.document_type !== null &&
      value.document_type !== undefined &&
      value.document_type !== "document" &&
      value.document_type !== "markdown")
  ) {
    throw new ApiRequestError("文档响应格式不正确")
  }
  return {
    documentType: value.document_type ?? null,
    id: value.id,
    kind: value.kind,
    parentId: value.parent_id ?? null,
    title: value.title,
    updatedAt: value.updated_at,
  }
}

function normalizeMember(value: MemberResponse): ClientProjectMember {
  if (
    !value.id ||
    (value.role !== "owner" && value.role !== "member") ||
    !Array.isArray(value.source_group_ids)
  ) {
    throw new ApiRequestError("项目成员响应格式不正确")
  }
  return {
    avatar: value.avatar ?? "",
    displayName: value.display_name ?? "",
    email: value.email ?? "",
    id: value.id,
    name: value.name ?? "",
    nickname: value.nickname ?? "",
    role: value.role,
    sourceGroupIds: value.source_group_ids,
    status: value.status ?? "",
  }
}
