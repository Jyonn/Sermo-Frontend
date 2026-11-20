import {useMobileVoiceInputMode} from '../lib/mobileVoiceInputMode';
import {useI18n} from '../lib/language';
import {SelectControl} from './SettingRow';

export function MobileVoiceInputSettings() {
  const {t} = useI18n();
  const [mode, setMode] = useMobileVoiceInputMode();
  return <SelectControl label={t('voiceInput.mode')} description={t('voiceInput.modeHint')} value={mode} onChange={setMode} options={[
      {value:'hold', label:t('composer.holdToTalk')},
      {value:'tap', label:t('voiceInput.tapToRecord')},
    ]}/>;
}
