import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Keyboard } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { YStack } from "tamagui"

import { KeyboardAwareScreen } from "@/components/layout/keyboard-aware-screen"
import { useAuthenticatedSession } from "@/providers/auth-provider"
import { SearchResultList } from "@/features/search/search-result-list"
import {
  buildGlobalSearchResults,
  type GlobalSearchResult,
} from "@/features/search/search-model"
import { buildConversationHref } from "@/navigation/conversations"
import { buildEntityDetailHref } from "@/navigation/entity-details"
import { buildProjectHref } from "@/navigation/projects"
import { messageSearchQueryOptions } from "@/data/query"
import { useClientData } from "@/providers/client-data-provider"
import { XGUIFilledSearchBar, useXGUITheme } from "@/xgui"

export function SearchScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { colors } = useXGUITheme()
  const session = useAuthenticatedSession()
  const {
    contacts,
    conversations,
    currentUser,
    personalProject,
    projects,
  } = useClientData()
  const [keyword, setKeyword] = useState("")
  const hasKeyword = keyword.trim().length > 0
  const messageSearch = useQuery(messageSearchQueryOptions(session, keyword))
  const results = useMemo(
    () =>
      buildGlobalSearchResults({
        contacts,
        conversations,
        currentUserId: currentUser?.id ?? null,
        keyword,
        messages: messageSearch.data,
        personalProject,
        projects,
      }),
    [
      contacts,
      conversations,
      currentUser?.id,
      keyword,
      messageSearch.data,
      personalProject,
      projects,
    ]
  )

  function handleCancel() {
    Keyboard.dismiss()
    router.back()
  }

  function handleResultPress(result: GlobalSearchResult) {
    Keyboard.dismiss()
    if (result.type === "project") {
      router.push(buildProjectHref(result.project.id))
      return
    }
    if (result.type === "conversation") {
      router.push(buildConversationHref(result.conversation.id))
      return
    }
    if (result.type === "message") {
      router.push(
        buildConversationHref(
          result.message.conversation.id,
          result.message.message.id
        )
      )
      return
    }

    router.push(
      buildEntityDetailHref({
        id: result.contact.id,
        type: result.contact.type,
      })
    )
  }

  return (
    <KeyboardAwareScreen
      contentBackground={colors.background0}
      edges={[]}
      scrollable={false}
    >
      <YStack bg={colors.background0} pt={insets.top}>
        <XGUIFilledSearchBar
          accessibilityLabel="搜索消息、联系人和项目"
          autoFocus
          onCancel={handleCancel}
          onChangeText={setKeyword}
          value={keyword}
        />
      </YStack>

      <YStack bg={colors.background0} flex={1} minH={0} pb={insets.bottom}>
        {hasKeyword ? (
          <SearchResultList
            currentUser={currentUser}
            messageSearchError={
              keyword.trim().length >= 2 && messageSearch.error instanceof Error
                ? messageSearch.error.message
                : undefined
            }
            messageSearchLoading={
              keyword.trim().length >= 2 && messageSearch.isPending
            }
            onResultPress={handleResultPress}
            results={results}
            server={session}
          />
        ) : null}
      </YStack>
    </KeyboardAwareScreen>
  )
}
