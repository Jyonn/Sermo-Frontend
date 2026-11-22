export const overlayAudiences = ['member', 'space', 'platform'] as const;
export const overlayKinds = ['drawer', 'sheet', 'modal', 'media', 'popover', 'feedback', 'controls'] as const;

export interface OverlayInventoryEntry {
  id: string;
  audiences: Array<typeof overlayAudiences[number]>;
  kind: typeof overlayKinds[number];
  component: string;
  source: string;
  title?: string;
  titleKey?: string;
  historyKey?: string;
  headerless?: boolean;
  contentUnderToolbar?: boolean;
  showTitle?: boolean;
  fullscreen?: boolean;
  danger?: boolean;
  tone?: string;
}
