import {useInterfacePreferences, type SquareLayoutChannel, type SquareEntryChannel} from './interfacePreferences';
import type {SquareFeedLayout} from './squareFeedLayout';

export function useSquareLayoutUnified() {
  const {preferences, save} = useInterfacePreferences();
  return [preferences.square_layout_mode !== 'per-channel',
    (unified: boolean) => save({square_layout_mode: unified ? 'unified' : 'per-channel'})] as const;
}

export function useSquareChannelLayout(channel: SquareLayoutChannel) {
  const {preferences, save} = useInterfacePreferences();
  const key = `square_layout_${channel}` as const;
  return [preferences[key] ?? 'list', (layout: SquareFeedLayout) => save({[key]: layout})] as const;
}

export function useSquareFeedLayout(channel: SquareLayoutChannel): SquareFeedLayout {
  const {preferences} = useInterfacePreferences();
  return preferences.square_layout_mode === 'per-channel' ? preferences[`square_layout_${channel}`] ?? 'list' : 'list';
}

export function useSquareEntry() {
  const {preferences, save, loaded} = useInterfacePreferences();
  return [preferences.square_entry ?? null, (channel: SquareEntryChannel) => save({square_entry: channel}), loaded] as const;
}
