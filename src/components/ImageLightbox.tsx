import type {ReactNode} from 'react';
import type {ImageMetadataDTO, TinyUserDTO} from '../types';
import {MediaDrawer, type MediaLightboxProps} from './MediaDrawer';

export {downloadMedia} from '../lib/downloadMedia';
export type {MediaLightboxItem} from './MediaDrawer';

export function MediaLightbox(props: MediaLightboxProps) {
  return <MediaDrawer {...props} />;
}

export function ImageLightbox({
  index, uris, altPrefix, details = [], metadata = [], owner, sharedDetail,
  downloadLabels = [], posterUris = [], fileNamePrefix, referrerPolicy, onClose, onIndexChange,
}: {
  index: number;
  uris: string[];
  altPrefix?: string;
  details?: ReactNode[];
  metadata?: Array<ImageMetadataDTO | null | undefined>;
  owner?: TinyUserDTO | null;
  sharedDetail?: ReactNode;
  downloadLabels?: string[];
  posterUris?: Array<string | null | undefined>;
  fileNamePrefix?: string;
  referrerPolicy?: 'no-referrer';
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  return <MediaDrawer altPrefix={altPrefix} fileNamePrefix={fileNamePrefix} index={index}
    items={uris.map((uri, position) => ({uri, kind: 'image', posterUri: posterUris[position], imageMetadata: metadata[position],
      owner, detail: details[position], downloadLabel: downloadLabels[position], referrerPolicy}))}
    onClose={onClose} onIndexChange={onIndexChange} sharedDetail={sharedDetail} />;
}
