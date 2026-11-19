import {useMobileVoiceInputMode} from '../lib/mobileVoiceInputMode';
import {useI18n} from '../lib/language';
import {SelectControl, SettingRow} from './SettingRow';

export function MobileVoiceInputSettings() {
  const {t} = useI18n();
  const [mode, setMode] = useMobileVoiceInputMode();
  return <SettingRow title={t('voiceInput.mode')} description={t('voiceInput.modeHint')} trailing={
    <SelectControl compact label={t('voiceInput.mode')} value={mode} onChange={setMode} options={[
      {value:'hold', label:t('composer.holdToTalk')},
      {value:'tap', label:t('voiceInput.tapToRecord')},
    ]}/>
  }/>;
}
