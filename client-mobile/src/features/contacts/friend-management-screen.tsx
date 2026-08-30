import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ContactDirectoryAvatar } from "@/features/contacts/contact-directory-avatar"
import { buildEntityDetailHref } from "@/navigation/entity-details"
import { AppHeader } from "@/components/navigation/app-header"
import { ContentState } from "@/components/feedback/content-state"
import { KeyboardAwareScreen } from "@/components/layout/keyboard-aware-screen"
import type { ContactUser, FriendRequest } from "@/core/models"
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  friendRequestUserIds,
  rejectFriendRequest,
  searchContactUsers,
} from "@/data/contacts"
import { friendRequestsQueryOptions, queryKeys } from "@/data/query"
import { useAuthenticatedSession } from "@/providers/auth-provider"
import { useClientContacts } from "@/providers/client-data-provider"
import {
  XGUIButton,
  XGUIInput,
  XGUIList,
  XGUIListItem,
  useXGUITheme,
  useXGUIToast,
} from "@/xgui"

type RequestRow = { direction: "incoming" | "outgoing"; request: FriendRequest }

export function FriendManagementScreen() {
  const router = useRouter()
  const session = useAuthenticatedSession()
  const queryClient = useQueryClient()
  const { colors } = useXGUITheme()
  const toast = useXGUIToast()
  const { contacts, ensureUsers, refreshContacts, usersById } = useClientContacts()
  const incoming = useQuery(friendRequestsQueryOptions(session, "incoming"))
  const outgoing = useQuery(friendRequestsQueryOptions(session, "outgoing"))
  const [query, setQuery] = useState("")
  const [resultIds, setResultIds] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const rows = useMemo<RequestRow[]>(
    () =>
      [
        ...(incoming.data ?? []).map((request) => ({
          direction: "incoming" as const,
          request,
        })),
        ...(outgoing.data ?? []).map((request) => ({
          direction: "outgoing" as const,
          request,
        })),
      ].sort(
        (left, right) =>
          Date.parse(right.request.updatedAt) - Date.parse(left.request.updatedAt)
      ),
    [incoming.data, outgoing.data]
  )
  const requestIds = useMemo(
    () => friendRequestUserIds(rows.map((row) => row.request), session.userId),
    [rows, session.userId]
  )

  useEffect(() => {
    const ids = [...new Set([...resultIds, ...requestIds])]
    if (ids.length > 0) void ensureUsers(ids).catch(() => undefined)
  }, [ensureUsers, requestIds, resultIds])

  async function handleSearch() {
    const value = query.trim()
    if (!value || searching) return
    setSearching(true)
    try {
      const ids = await searchContactUsers(session, value)
      await ensureUsers(ids)
      setResultIds(ids.filter((id) => id.toLocaleLowerCase() !== session.userId.toLocaleLowerCase()))
    } catch (error: unknown) {
      toast.show({ message: error instanceof Error ? error.message : "查找用户失败", modal: false, type: "error" })
    } finally {
      setSearching(false)
    }
  }

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    if (busyKey) return
    setBusyKey(key)
    try {
      await action()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests(session, "incoming") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests(session, "outgoing") }),
      ])
      await refreshContacts()
      toast.show({ duration: 1_000, message, modal: false, type: "success" })
    } catch (error: unknown) {
      toast.show({ message: error instanceof Error ? error.message : "好友操作失败", modal: false, type: "error" })
    } finally {
      setBusyKey(null)
    }
  }

  const loading = incoming.isPending || outgoing.isPending
  const error = incoming.error ?? outgoing.error
  return (
    <View style={[styles.screen, { backgroundColor: colors.background0 }]}>
      <AppHeader onBackPress={() => router.back()} title="新朋友" />
      <KeyboardAwareScreen contentBackground={colors.background0} edges={[]} scrollable>
        <View style={styles.searchArea}>
          <XGUIInput
            autoCapitalize="none"
            autoCorrect={false}
            clearable
            label="查找"
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearch()}
            placeholder="完整邮箱、手机号或用户 ID"
            returnKeyType="search"
            value={query}
          />
          <XGUIButton disabled={!query.trim() || searching} loading={searching} onPress={() => void handleSearch()} size="mini">
            查找用户
          </XGUIButton>
        </View>
        {resultIds.length > 0 ? (
          <XGUIList title="查找结果">
            {resultIds.map((id, index) => {
              const user = usersById[id]
              const displayUser = user ?? createPlaceholderUser(id)
              const pending = rows.some(
                ({ request }) =>
                  request.status === "pending" &&
                  (request.requesterUserId === id || request.addresseeUserId === id)
              )
              const isFriend = contacts.users.some((friend) => friend.id === id)
              return (
                <FriendRow
                  key={id}
                  separator={index > 0}
                  user={displayUser}
                  onPress={() => router.push(buildEntityDetailHref({ id, type: "user" }))}
                  trailing={
                    <XGUIButton
                      disabled={pending || isFriend || busyKey !== null}
                      onPress={() =>
                        void run(`add:${id}`, () => createFriendRequest(session, id), isFriend ? "已是好友" : "好友申请已发送")
                      }
                      size="mini"
                      variant="secondary"
                    >
                      {isFriend ? "已是好友" : pending ? "申请处理中" : "添加好友"}
                    </XGUIButton>
                  }
                />
              )
            })}
          </XGUIList>
        ) : null}
        {loading ? <ContentState loading message="正在加载好友申请" /> : null}
        {error ? <ContentState message={error instanceof Error ? error.message : "加载好友申请失败"} tone="error" /> : null}
        {!loading && !error ? (
          <XGUIList title="好友申请">
            {rows.length === 0 ? (
              <ContentState message="暂无好友申请" />
            ) : (
              rows.map(({ direction, request }, index) => {
                const userId = direction === "incoming" ? request.requesterUserId : request.addresseeUserId
                const user = usersById[userId] ?? createPlaceholderUser(userId)
                const pending = request.status === "pending"
                return (
                  <FriendRow
                    key={request.id}
                    separator={index > 0}
                    user={user}
                    onPress={() => router.push(buildEntityDetailHref({ id: user.id, type: "user" }))}
                    description={direction === "incoming" ? "请求添加你为好友" : "你发出了好友申请"}
                    trailing={pending ? (
                      direction === "incoming" ? (
                        <View style={styles.actions}>
                          <XGUIButton disabled={busyKey !== null} onPress={() => void run(request.id, () => acceptFriendRequest(session, request.id), "已添加好友")} size="mini">接受</XGUIButton>
                          <XGUIButton disabled={busyKey !== null} onPress={() => void run(request.id, () => rejectFriendRequest(session, request.id), "已拒绝好友申请")} size="mini" variant="secondary">拒绝</XGUIButton>
                        </View>
                      ) : (
                        <XGUIButton disabled={busyKey !== null} onPress={() => void run(request.id, () => cancelFriendRequest(session, request.id), "好友申请已取消")} size="mini" variant="secondary">取消申请</XGUIButton>
                      )
                    ) : <Text style={[styles.status, { color: colors.textSecondary }]}>{requestStatus(request.status)}</Text>}
                  />
                )
              })
            )}
          </XGUIList>
        ) : null}
      </KeyboardAwareScreen>
    </View>
  )
}

function FriendRow({
  description,
  separator,
  onPress,
  trailing,
  user,
}: {
  description?: string
  separator: boolean
  onPress: () => void
  trailing: ReactNode
  user: ContactUser
}) {
  const session = useAuthenticatedSession()
  const displayName = user.nickname || user.name || shortUserId(user.id)
  return (
    <XGUIListItem
      description={description ?? (user.email || user.id)}
      leading={<ContactDirectoryAvatar avatar={user.avatar} name={displayName} online={user.online} server={session} type="user" />}
      onPress={onPress}
      separator={separator}
      title={displayName}
      trailing={trailing}
    />
  )
}

function requestStatus(status: FriendRequest["status"]) {
  if (status === "accepted") return "已通过"
  if (status === "rejected") return "已拒绝"
  if (status === "canceled") return "已取消"
  return "等待处理"
}

function createPlaceholderUser(id: string): ContactUser {
  return {
    avatar: "",
    email: "",
    id,
    lastOnlineAt: null,
    name: "",
    nickname: "",
    online: false,
    phone: "",
    type: "user",
  }
}

function shortUserId(id: string) {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 6 },
  screen: { flex: 1 },
  searchArea: { gap: 8, paddingBottom: 16, paddingTop: 8 },
  status: { fontSize: 14 },
})
