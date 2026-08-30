// Tabler exposes per-icon runtime entry points without per-icon declarations.
// eslint-disable-next-line import/no-unresolved
import IconCalendar from "@tabler/icons-react-native/IconCalendar"
// eslint-disable-next-line import/no-unresolved
import IconChevronRight from "@tabler/icons-react-native/IconChevronRight"
// eslint-disable-next-line import/no-unresolved
import IconFileText from "@tabler/icons-react-native/IconFileText"
// eslint-disable-next-line import/no-unresolved
import IconTarget from "@tabler/icons-react-native/IconTarget"
// eslint-disable-next-line import/no-unresolved
import IconCheckbox from "@tabler/icons-react-native/IconCheckbox"
// eslint-disable-next-line import/no-unresolved
import IconUsers from "@tabler/icons-react-native/IconUsers"
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { ContentState } from "@/components/feedback/content-state"
import { AppHeader } from "@/components/navigation/app-header"
import type {
  ClientProjectDocument,
  ClientProjectMember,
  ClientProjectTask,
} from "@/core/models"
import { projectDetailsQueryOptions } from "@/data/query"
import { formatActivityTime } from "@/domain/time/activity-time"
import { useAuthenticatedSession } from "@/providers/auth-provider"
import { useClientContacts, useClientProjects, useClientSession } from "@/providers/client-data-provider"
import { ProjectAvatar } from "@/features/projects/project-avatar"
import { ContactDirectoryAvatar } from "@/features/contacts/contact-directory-avatar"
import { useXGUITheme } from "@/xgui"
import type { ProjectSection } from "@/navigation/projects"

const SECTIONS: { icon: typeof IconCheckbox; key: ProjectSection; label: string }[] = [
  { icon: IconCheckbox, key: "tasks", label: "任务" },
  { icon: IconCalendar, key: "calendar", label: "日历" },
  { icon: IconFileText, key: "documents", label: "文档" },
  { icon: IconTarget, key: "goals", label: "目标" },
  { icon: IconUsers, key: "members", label: "成员" },
]

export function ProjectDetailsScreen() {
  const params = useLocalSearchParams<{
    projectId?: string | string[]
    section?: string | string[]
  }>()
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId
  const router = useRouter()
  const session = useAuthenticatedSession()
  const { colors } = useXGUITheme()
  const { personalProject, projects } = useClientProjects()
  const { currentUser } = useClientSession()
  const { ensureUsers, usersById } = useClientContacts()
  const requestedSection = Array.isArray(params.section) ? params.section[0] : params.section
  const initialSection: ProjectSection =
    requestedSection === "calendar" || requestedSection === "documents" || requestedSection === "goals" || requestedSection === "tasks" || requestedSection === "members"
      ? requestedSection
      : "tasks"
  const [section, setSection] = useState<ProjectSection>(initialSection)
  const project = useMemo(
    () => [personalProject, ...projects].find((item) => item?.id === projectId),
    [personalProject, projectId, projects]
  )
  const detail = useQuery({
    ...projectDetailsQueryOptions(session, projectId ?? ""),
    enabled: Boolean(projectId),
  })
  const taskAssigneeIds = useMemo(
    () =>
      (detail.data?.tasks ?? [])
        .map((task) => task.assigneeId)
        .filter((id): id is string => Boolean(id)),
    [detail.data?.tasks]
  )
  const memberIds = useMemo(
    () => (detail.data?.members ?? []).map((member) => member.id),
    [detail.data?.members]
  )
  useEffect(() => {
    const ids = [...new Set([...taskAssigneeIds, ...memberIds])]
    if (ids.length > 0) void ensureUsers(ids).catch(() => undefined)
  }, [ensureUsers, memberIds, taskAssigneeIds])

  if (!projectId) {
    return <ContentState message="项目不存在" />
  }
  if (detail.isPending) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background0 }]}>
        <AppHeader onBackPress={() => router.back()} title="项目" />
        <ContentState loading message="正在加载项目" />
      </View>
    )
  }
  if (detail.error) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background0 }]}>
        <AppHeader onBackPress={() => router.back()} title="项目" />
        <ContentState message={detail.error instanceof Error ? detail.error.message : "项目加载失败"} tone="error" />
      </View>
    )
  }

  const tasks = (detail.data?.tasks ?? []).map((task) => {
    const user = task.assigneeId ? usersById[task.assigneeId] : undefined
    return user
      ? { ...task, assigneeName: user.nickname || user.name }
      : task
  })
  const documents = detail.data?.documents ?? []
  const members = (detail.data?.members ?? []).map((member) => {
    const user = usersById[member.id]
    return user
      ? {
          ...member,
          avatar: user.avatar,
          displayName: user.nickname || user.name || member.displayName,
          email: user.email || member.email,
          name: user.name || member.name,
          nickname: user.nickname || member.nickname,
        }
      : member
  })
  return (
    <View style={[styles.screen, { backgroundColor: colors.background0 }]}>
      <AppHeader onBackPress={() => router.back()} title={project?.name ?? "项目"} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {project ? (
          <View style={[styles.summary, { backgroundColor: colors.background2 }]}>
            <ProjectAvatar currentUser={currentUser} project={project} server={session} />
            <View style={styles.summaryBody}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{project.name}</Text>
              <Text numberOfLines={2} style={[styles.description, { color: colors.textSecondary }]}>{project.description.trim() || "暂无说明"}</Text>
            </View>
          </View>
        ) : null}
        <View style={[styles.tabs, { backgroundColor: colors.background2 }]}>
          {SECTIONS.map((item) => {
            const Icon = item.icon
            const active = section === item.key
            return (
              <Pressable
                accessibilityLabel={`查看${item.label}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={item.key}
                onPress={() => setSection(item.key)}
                style={[styles.tab, active ? { backgroundColor: colors.background1 } : null]}
              >
                <Icon color={active ? colors.brand : colors.textSecondary} size={18} strokeWidth={1.7} />
                <Text style={[styles.tabLabel, { color: active ? colors.brand : colors.textSecondary }]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>
        {section === "tasks" ? <TaskList tasks={tasks} colors={colors} /> : null}
        {section === "calendar" ? <CalendarList tasks={tasks} colors={colors} /> : null}
        {section === "documents" ? <DocumentList documents={documents} colors={colors} /> : null}
        {section === "goals" ? <GoalSummary tasks={tasks} colors={colors} /> : null}
        {section === "members" ? <MemberList members={members} colors={colors} server={session} /> : null}
      </ScrollView>
    </View>
  )
}

function MemberList({
  colors,
  members,
  server,
}: {
  colors: ReturnType<typeof useXGUITheme>["colors"]
  members: ClientProjectMember[]
  server: ReturnType<typeof useAuthenticatedSession>
}) {
  if (members.length === 0) return <ContentState message="暂无项目成员" />
  return (
    <View style={[styles.list, { backgroundColor: colors.background2 }]}>
      {members.map((member, index) => {
        const displayName =
          member.displayName || member.nickname || member.name || "未命名成员"
        return (
          <View
            key={member.id}
            style={[
              styles.member,
              index > 0
                ? {
                    borderTopColor: colors.separator,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  }
                : null,
            ]}
          >
            <ContactDirectoryAvatar
              avatar={member.avatar}
              name={displayName}
              server={server}
              type="user"
            />
            <View style={styles.taskBody}>
              <Text numberOfLines={1} style={[styles.taskTitle, { color: colors.textPrimary }]}>
                {displayName}
              </Text>
              <Text numberOfLines={1} style={[styles.taskMeta, { color: colors.textSecondary }]}>
                {member.role === "owner" ? "所有者" : "成员"} · {member.email || "暂无邮箱"}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function TaskList({ tasks, colors }: { tasks: ClientProjectTask[]; colors: ReturnType<typeof useXGUITheme>["colors"] }) {
  if (tasks.length === 0) return <ContentState message="暂无任务" />
  return (
    <View style={[styles.list, { backgroundColor: colors.background2 }]}>
      {tasks.map((task, index) => (
        <View key={task.id} style={[styles.task, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
          <View style={[styles.statusDot, { backgroundColor: taskStatusColor(task.status, colors) }]} />
          <View style={styles.taskBody}>
            <Text numberOfLines={2} style={[styles.taskTitle, { color: colors.textPrimary }]}>{task.title}</Text>
            <Text numberOfLines={1} style={[styles.taskMeta, { color: colors.textSecondary }]}>{taskStatusLabel(task.status)} · {task.assigneeName}{task.dueDate ? ` · 截止 ${formatDate(task.dueDate)}` : ""}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function CalendarList({ tasks, colors }: { tasks: ClientProjectTask[]; colors: ReturnType<typeof useXGUITheme>["colors"] }) {
  const scheduled = tasks.filter((task) => task.startDate || task.dueDate)
  if (scheduled.length === 0) return <ContentState message="暂无排期任务" />
  return (
    <View style={[styles.list, { backgroundColor: colors.background2 }]}>
      {scheduled.map((task, index) => (
        <View key={task.id} style={[styles.task, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
          <IconCalendar color={colors.brand} size={20} strokeWidth={1.5} />
          <View style={styles.taskBody}>
            <Text numberOfLines={1} style={[styles.taskTitle, { color: colors.textPrimary }]}>{task.title}</Text>
            <Text style={[styles.taskMeta, { color: colors.textSecondary }]}>{task.startDate ? formatDate(task.startDate) : "未设置开始日期"} → {task.dueDate ? formatDate(task.dueDate) : "未设置截止日期"}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function DocumentList({ documents, colors }: { documents: ClientProjectDocument[]; colors: ReturnType<typeof useXGUITheme>["colors"] }) {
  if (documents.length === 0) return <ContentState message="暂无文档" />
  return (
    <View style={[styles.list, { backgroundColor: colors.background2 }]}>
      {documents.map((document, index) => (
        <View key={document.id} style={[styles.document, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
          <IconFileText color={colors.brand} size={20} strokeWidth={1.5} />
          <View style={styles.taskBody}>
            <Text numberOfLines={1} style={[styles.taskTitle, { color: colors.textPrimary }]}>{document.title}</Text>
            <Text style={[styles.taskMeta, { color: colors.textSecondary }]}>{document.kind === "folder" ? "目录" : document.documentType === "markdown" ? "Markdown 文档" : "富文档"} · 更新于 {formatActivityTime(document.updatedAt)}</Text>
          </View>
          <IconChevronRight color={colors.textPlaceholder} size={18} strokeWidth={1.5} />
        </View>
      ))}
    </View>
  )
}

function GoalSummary({ tasks, colors }: { tasks: ClientProjectTask[]; colors: ReturnType<typeof useXGUITheme>["colors"] }) {
  const done = tasks.filter((task) => task.status === "done").length
  const total = tasks.length
  return (
    <View style={[styles.goal, { backgroundColor: colors.background2 }]}>
      <IconTarget color={colors.brand} size={28} strokeWidth={1.5} />
      <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>项目进度</Text>
      <Text style={[styles.goalValue, { color: colors.brand }]}>{total > 0 ? `${Math.round((done / total) * 100)}%` : "—"}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{total > 0 ? `已完成 ${done} / ${total} 个任务` : "先创建任务，再从这里跟踪项目目标"}</Text>
    </View>
  )
}

function taskStatusLabel(status: ClientProjectTask["status"]) {
  if (status === "done") return "已完成"
  if (status === "in_progress") return "进行中"
  if (status === "canceled") return "已取消"
  return "待处理"
}

function taskStatusColor(status: ClientProjectTask["status"], colors: ReturnType<typeof useXGUITheme>["colors"]) {
  if (status === "done") return colors.green
  if (status === "in_progress") return colors.brand
  if (status === "canceled") return colors.textPlaceholder
  return colors.orange
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(parsed)
}

const styles = StyleSheet.create({
  content: { gap: 8, paddingBottom: 24, paddingHorizontal: 8, paddingTop: 8 },
  description: { fontSize: 14, lineHeight: 20 },
  document: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 64, paddingHorizontal: 16 },
  goal: { alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 28 },
  goalTitle: { fontSize: 17, fontWeight: "600" },
  goalValue: { fontSize: 32, fontWeight: "700" },
  list: { overflow: "hidden" },
  member: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 68, paddingHorizontal: 16 },
  screen: { flex: 1 },
  statusDot: { borderRadius: 5, height: 10, width: 10 },
  summary: { alignItems: "center", flexDirection: "row", gap: 12, padding: 16 },
  summaryBody: { flex: 1, gap: 4, minWidth: 0 },
  tab: { alignItems: "center", borderRadius: 8, flex: 1, gap: 4, paddingVertical: 9 },
  tabLabel: { fontSize: 13 },
  tabs: { flexDirection: "row", gap: 4, padding: 4 },
  task: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 68, paddingHorizontal: 16 },
  taskBody: { flex: 1, gap: 4, minWidth: 0 },
  taskMeta: { fontSize: 13 },
  taskTitle: { fontSize: 16, lineHeight: 22 },
  title: { fontSize: 18, fontWeight: "600" },
})
