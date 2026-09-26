import type { LinkPreviewDTO } from "../types";
import { DouyinVideoPreview, isDouyinVideoData } from "./DouyinVideoPreview";
import { isMusicData, MusicPreview } from "./NeteaseMusicPreview";

export function isSupportedExternalMedia(preview?: LinkPreviewDTO | null) {
  return isMusicData(preview?.provider_data) || isDouyinVideoData(preview?.provider_data);
}

export function ExternalMediaPreview({ preview }: { preview: LinkPreviewDTO }) {
  if (isMusicData(preview.provider_data)) return <MusicPreview music={preview.provider_data} />;
  if (isDouyinVideoData(preview.provider_data)) {
    return <DouyinVideoPreview previewId={preview.preview_id} video={preview.provider_data} imageUrl={preview.image_url} />;
  }
  return null;
}
