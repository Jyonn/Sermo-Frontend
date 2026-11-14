import type { LinkPreviewDTO } from "../types";
import {monifaShareUrl} from '../lib/monifa';
import {MonifaOtpCard} from './MonifaOtpCard';
import { DouyinVideoPreview, isDouyinVideoData } from "./DouyinVideoPreview";
import { isMusicData, MusicPreview } from "./NeteaseMusicPreview";
import { isSocialMediaData, SocialMediaPreview } from "./SocialMediaPreview";
import { UnsupportedContentNotice } from "./UnsupportedContentNotice";
import { isStillfolioCollection, StillfolioPreview } from "./StillfolioPreview";
import { isPockloShare, PockloShareCard } from "./PockloShareCard";
import { CURRENT_RELEASE } from "../lib/pwaUpdate";
import { needsContentUpgrade } from "../lib/contentCompatibility";
import {isPockloSong} from '../lib/pockloSong';
import {PockloSongCard} from './PockloSongCard';

export function isSupportedExternalMedia(preview?: LinkPreviewDTO | null) {
  return !needsContentUpgrade(preview?.min_client_version, CURRENT_RELEASE.id)
    && (Boolean(monifaShareUrl(preview?.url)) || isMusicData(preview?.provider_data) || isDouyinVideoData(preview?.provider_data) || isSocialMediaData(preview?.provider_data) || isStillfolioCollection(preview?.provider_data) || isPockloShare(preview?.provider_data));
}

export function ExternalMediaPreview({ preview,fitMedia=false }: { preview: LinkPreviewDTO;fitMedia?:boolean }) {
  if (!isSupportedExternalMedia(preview)) return <UnsupportedContentNotice minVersion={preview.min_client_version} title={preview.title || preview.site_name} url={preview.url} />;
  const monifaUrl=monifaShareUrl(preview.url);
  if(monifaUrl)return <MonifaOtpCard url={monifaUrl}/>;
  if (isPockloSong(preview.provider_data)) return <PockloSongCard reference={preview.provider_data}/>;
  if (isMusicData(preview.provider_data)) return <MusicPreview music={preview.provider_data} />;
  if (isDouyinVideoData(preview.provider_data)) {
    return <DouyinVideoPreview previewId={preview.preview_id} video={preview.provider_data} imageUrl={preview.image_url} fitMedia={fitMedia} />;
  }
  if (isSocialMediaData(preview.provider_data)) return <SocialMediaPreview media={preview.provider_data} imageUrl={preview.image_url} fitMedia={fitMedia} />;
  if (isStillfolioCollection(preview.provider_data)) return <StillfolioPreview collection={preview.provider_data} previewId={preview.preview_id} />;
  if (isPockloShare(preview.provider_data)) return <PockloShareCard share={preview.provider_data} />;
  return <UnsupportedContentNotice minVersion={preview.min_client_version} title={preview.title || preview.site_name} url={preview.url} />;
}
