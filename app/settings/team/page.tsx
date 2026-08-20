import { redirect } from "next/navigation";

// This page used to be its own team-management UI (TeamSettingsPanel),
// which duplicated /team after that page became the consolidated place
// for inviting and managing team members. This route stays only so old
// links/bookmarks to /settings/team don't 404 - it just forwards to /team.
export default function TeamSettingsRedirectPage() {
  redirect("/team");
}
