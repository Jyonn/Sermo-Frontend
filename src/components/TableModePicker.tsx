import {useI18n, type TranslationKey} from '../lib/language';
import './TableModePicker.css';

export function TableModePicker<T extends string>({choices, mode, disabled, onChange}: {
  choices: ReadonlyArray<readonly [T, TranslationKey]>;
  mode: T;
  disabled?: boolean;
  onChange: (mode: T) => void;
}) {
  const {t} = useI18n();
  return <div className="table-mode-picker" role="group" aria-label={t('tabletop.roomMode')}>
    {choices.map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value}
      disabled={disabled} onClick={() => {if (value !== mode) onChange(value);}}>{t(label)}</button>)}
  </div>;
}
