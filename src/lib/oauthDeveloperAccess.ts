import type { SpaceDTO } from "../types";

export function canManageOAuthApplications(space: SpaceDTO | null, currentSpaceId: number | undefined) {
  return Boolean(space && space.space_id === currentSpaceId && space.oauth_developer_available === true);
}
