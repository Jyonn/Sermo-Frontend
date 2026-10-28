import { preloadLanguageChoices, type SupportedLanguage } from '../lib/i18n';
import { useI18n } from '../lib/language';
import { SelectControl } from './SettingRow';

// i18n-ignore: language names stay native.
const options: Array<{value: SupportedLanguage; label: string}> = [{value:'zh-CN',label:'简体中文'},{value:'zh-TW',label:'繁體中文'},{value:'en',label:'English'},{value:'ja',label:'日本語'},{value:'ko',label:'한국어'},{value:'es',label:'Español'}];

export function LanguageSelectControl({ value, onChange, disabled }: {value: SupportedLanguage; onChange: (value: SupportedLanguage) => void | Promise<void>; disabled?: boolean}) {
  const {t}=useI18n();
  return <SelectControl compact label={t('menu.language')} value={value} onChange={onChange} options={options} disabled={disabled} onOpen={preloadLanguageChoices}/>;
}
