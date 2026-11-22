import {mediaDownloadUri, mediaSourceCandidates} from './messageMedia';

const isManaged = (uri: string) => /\/(?:messages\/blob|square\/media)\/[^/?]+\/download(?:\?|$)/.test(uri);

export async function mediaFile(uri: string, prefix: string) {
  const downloadUri = mediaDownloadUri(uri);
  const managed = isManaged(downloadUri);
  const {primary, fallback} = managed ? {primary: downloadUri, fallback: undefined} : mediaSourceCandidates(downloadUri);
  const response = await fetch(primary).then(response => {
    if (managed && response.status === 409) throw new Error('media_processing');
    if (!response.ok) throw new Error('download_failed');
    return response;
  }).catch(error => {
    if (fallback && fallback !== primary) return fetch(fallback);
    throw error;
  });
  if (!response.ok || /text\/html|application\/json/.test(response.headers.get('Content-Type') ?? '')) throw new Error('download_failed');
  const blob = await response.blob();
  const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov') || 'bin';
  return new File([blob], `${prefix}-${Date.now()}.${extension}`, {type: blob.type});
}

export function saveMediaFile(file: File) {
  const uri = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = uri;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(uri), 1000);
}

export async function downloadMedia(uri: string, prefix: string) {
  try {
    saveMediaFile(await mediaFile(uri, prefix));
  } catch (error) {
    if (isManaged(mediaDownloadUri(uri))) throw error;
    if (!window.open(mediaSourceCandidates(uri).fallback ?? uri, '_blank', 'noopener,noreferrer')) throw new Error('download_failed');
  }
}
