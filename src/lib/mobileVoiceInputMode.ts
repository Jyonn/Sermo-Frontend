import {useInterfacePreferences, type MobileVoiceInputMode} from './interfacePreferences';

export type {MobileVoiceInputMode};

export function useMobileVoiceInputMode() {
  const {preferences, save} = useInterfacePreferences();
  return [preferences.mobile_voice_input ?? 'hold', (mode: MobileVoiceInputMode) => save({mobile_voice_input: mode})] as const;
}
