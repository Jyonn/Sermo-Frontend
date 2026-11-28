import type {LinkPreviewDTO} from '../types';

const socialHosts = new Set([
  'douyin.com', 'www.douyin.com', 'v.douyin.com', 'iesdouyin.com', 'www.iesdouyin.com',
  'xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com', 'www.xhslink.com', 'xhslink.cn', 'www.xhslink.cn',
]);
const socialProviders = new Set(['douyin_video', 'douyin_gallery', 'xiaohongshu_video', 'xiaohongshu_gallery']);

export function isSocialUrl(url: string) {
  try {return socialHosts.has(new URL(url).hostname);} catch {return false;}
}

export function socialShareTitle(preview?: LinkPreviewDTO | null) {
  const data = preview?.provider_data;
  return preview?.title?.trim() || (data && 'title' in data && typeof data.title === 'string' ? data.title.trim() : '');
}

export function hasSocialShareMetadata(preview?: LinkPreviewDTO | null): preview is LinkPreviewDTO {
  if (preview?.status !== 'ready') return false;
  const provider = preview.provider_data?.provider;
  return (isSocialUrl(preview.url ?? '') || (typeof provider === 'string' && socialProviders.has(provider))) &&
    Boolean(socialShareTitle(preview) || preview.description || preview.image_url);
}

function comparableTitle(text: string) {
  return text.normalize('NFKC').replace(/\s+/gu, '').replace(/[。.!?]+$/u, '').toLowerCase();
}

export function isRepeatedShareText(text: string, title: string) {
  const comparable = comparableTitle(title);
  return Boolean(comparable && comparable === comparableTitle(text));
}

export function socialShareCaption(text: string, preview?: LinkPreviewDTO | null) {
  if (!hasSocialShareMetadata(preview)) return text;
  const data = preview.provider_data;
  const canonical = data && 'canonical_url' in data ? data.canonical_url : undefined;
  const trimmed = text.trim();
  const reference = [preview.url, canonical].find(value => typeof value === 'string' && value && trimmed.endsWith(value));
  const withoutLink = typeof reference === 'string' ? trimmed.slice(0, -reference.length).trim() : trimmed;
  if (reference && !withoutLink) return '';
  return isRepeatedShareText(withoutLink, socialShareTitle(preview)) ? '' : text;
}
