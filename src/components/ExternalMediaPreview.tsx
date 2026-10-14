import type { LinkPreviewDTO } from "../types";
import { DouyinVideoPreview, isDouyinVideoData } from "./DouyinVideoPreview";
import { isMusicData, MusicPreview } from "./NeteaseMusicPreview";
import { isSocialMediaData, SocialMediaPreview } from "./SocialMediaPreview";
import { UnsupportedContentNotice } from "./UnsupportedContentNotice";
import { isStillfolioCollection, StillfolioPreview } from "./StillfolioPreview";
import { CURRENT_RELEASE } from "../lib/pwaUpdate";
import { needsContentUpgrade } from "../lib/contentCompatibility";

export function isSupportedExternalMedia(preview?: LinkPreviewDTO | null) {
  return !needsContentUpgrade(preview?.min_client_version, CURRENT_RELEASE.id)
    && (isMusicData(preview?.provider_data) || isDouyinVideoData(preview?.provider_data) || isSocialMediaData(preview?.provider_data) || isStillfolioCollection(preview?.provider_data));
}

export function ExternalMediaPreview({ preview }: { preview: LinkPreviewDTO }) {
  if (!isSupportedExternalMedia(preview)) return <UnsupportedContentNotice minVersion={preview.min_client_version} title={preview.title || preview.site_name} url={preview.url} />;
  if (isMusicData(preview.provider_data)) return <MusicPreview music={preview.provider_data} />;
  if (isDouyinVideoData(preview.provider_data)) {
    return <DouyinVideoPreview previewId={preview.preview_id} video={preview.provider_data} imageUrl={preview.image_url} />;
  }
  if (isSocialMediaData(preview.provider_data)) return <SocialMediaPreview media={preview.provider_data} imageUrl={preview.image_url} />;
  if (isStillfolioCollection(preview.provider_data)) return <StillfolioPreview collection={preview.provider_data} previewId={preview.preview_id} />;
  return <UnsupportedContentNotice minVersion={preview.min_client_version} title={preview.title || preview.site_name} url={preview.url} />;
}
