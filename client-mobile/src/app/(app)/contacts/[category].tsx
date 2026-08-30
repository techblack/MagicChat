import { useLocalSearchParams } from "expo-router"

import { ContactDirectoryCategoryScreen } from "@/features/contacts/contact-directory-category-screen"
import { FriendManagementScreen } from "@/features/contacts/friend-management-screen"

export default function ContactCategoryRoute() {
  const params = useLocalSearchParams<{ category?: string | string[] }>()
  const category = Array.isArray(params.category) ? params.category[0] : params.category
  return category === "new-friends" ? <FriendManagementScreen /> : <ContactDirectoryCategoryScreen />
}
