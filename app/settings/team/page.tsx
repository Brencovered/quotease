import { redirect } from "next/navigation";

// This used to be a second, independent team-management implementation
// (TeamSettingsPanel) alongside /team's (TeamPageClient) - two different
// components, two different queries, one of them silently calling API
// methods that didn't exist. Consolidated: /team is now the single source
// of truth, this just redirects there.
export default function TeamSettingsRedirect() {
  redirect("/team");
}
