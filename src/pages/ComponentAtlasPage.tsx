import {useEffect, useState} from 'react';
import inventory from 'virtual:overlay-inventory';
import {ActionSheet} from '../components/ActionSheet';
import {AlertDialog} from '../components/AlertDialog';
import {AsyncErrorDialog} from '../components/AsyncErrorDialog';
import {BottomSheet} from '../components/BottomSheet';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {FloatingDrawerScope} from '../components/DesktopPanelWorkspace';
import {ExternalAppAction, ExternalAppActions, ExternalAppIdentity} from '../components/ExternalAppPanel';
import {FeedbackState} from '../components/FeedbackState';
import {InlineAlert} from '../components/InlineAlert';
import {InputDialog} from '../components/InputDialog';
import {MediaLightbox} from '../components/ImageLightbox';
import {OverlayIconButton} from '../components/OverlayIconButton';
import {SelectControl, SettingGroup, SettingRow, SettingSwitch} from '../components/SettingRow';
import {SettingsDialog} from '../components/SettingsDialog';
import {SideDrawer} from '../components/SideDrawer';
import {Snackbar} from '../components/Snackbar';
import {SquareComposerEditor} from '../components/SquareComposerEditor';
import {activityDrawerClassName} from '../lib/activityTheme';
import {DROP_ICON} from '../lib/dropPicker';
import {useI18n, type TranslationKey} from '../lib/language';
import {overlayAudiences, overlayKinds, type OverlayInventoryEntry} from '../lib/overlayInventory';
import chronelleIcon from '../assets/chronelle-icon.png';
import pockloIcon from '../assets/pocklo-mark.svg';
import stillfolioMark from '../assets/stillfolio-mark.svg';
import './ComponentAtlasPage.css';

const photo = '/themes/christmas-2026/shop-window.webp';
const externalApps = {
  DropDrawer: {logo: DROP_ICON, name: 'drop.name', description: 'drop.hint', open: 'drop.open', manage: 'drop.disconnect'},
  PockloDrawer: {logo: pockloIcon, name: 'pocklo.name', description: 'pocklo.menuHint', open: 'pocklo.open', manage: 'pocklo.disconnect'},
  StillfolioDrawer: {logo: stillfolioMark, name: 'apps.stillfolio', description: 'apps.stillfolioDescription', open: 'stillfolio.open', manage: 'stillfolio.disconnect'},
  chronelle: {logo: chronelleIcon, name: 'chronelle.title', description: 'apps.chronelleSummary', open: 'apps.openChronelle', manage: 'apps.chronelleDisplay'},
} satisfies Record<string, {logo: string; name: TranslationKey; description: TranslationKey; open: TranslationKey; manage: TranslationKey}>;
const icons = {drawer: 'side_navigation', sheet: 'bottom_panel_open', modal: 'dialogs', media: 'photo_library', popover: 'more_horiz', feedback: 'info', controls: 'tune'};
const appFor = (entry: OverlayInventoryEntry) => {
  const key = entry.historyKey === 'chronelle' ? 'chronelle' : entry.component;
  return Object.prototype.hasOwnProperty.call(externalApps, key) ? externalApps[key as keyof typeof externalApps] : undefined;
};

function SurfacePreview({entry, title, close}: {entry: OverlayInventoryEntry; title: string; close: () => void}) {
  const {t} = useI18n();
  const [value, setValue] = useState('');
  const [option, setOption] = useState('light');
  const [mediaIndex, setMediaIndex] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const hint = t('patterns.localOnly');
  const app = appFor(entry);
  const sample = <div className="atlas-preview-content">
    <p>{hint}</p>
    <label className="atlas-preview-field">
      <span>{t('atlas.sampleField')}</span>
      <input className="input" value={value} onChange={event => setValue(event.target.value)} />
    </label>
    <div className="atlas-preview-actions">
      <button type="button" className="ghost-button" onClick={close}>{t('common.cancel')}</button>
      <button type="button" className="button" onClick={close}>{t('common.done')}</button>
    </div>
  </div>;
  if (entry.kind === 'drawer') {
    const isComposer = entry.historyKey === 'square-compose';
    const isActivity = /\/(?:ActivityExperience|activityOverlay)\.tsx:/.test(entry.source);
    const cover = entry.headerless || entry.contentUnderToolbar;
    const share = cover && !app ? <OverlayIconButton icon="share" aria-label={t('references.share')} onClick={close} /> : undefined;
    const drawer = <SideDrawer open title={title} showTitle={entry.showTitle} headerless={entry.headerless}
      fullscreen={entry.fullscreen} contentUnderToolbar={entry.contentUnderToolbar} historyMode="route" onClose={close} trapFocus
      className={isComposer ? 'square-compose-side-drawer' : isActivity ? activityDrawerClassName('explorer-2026') : undefined}
      floatingBack={!isComposer} floatingAccessory={entry.headerless && !isComposer ? share : undefined}
      headerAction={entry.contentUnderToolbar ? share : undefined}>
      {isComposer ? <SquareComposerEditor text={value} onText={setValue} limit={140} photos={[]} video={null} voice={null} external={null}
        onRemovePhoto={close} onRemoveVideo={close} onRemoveVoice={close} onRemoveExternal={close} onAdd={close}
        onBack={close} onPublish={close} onAudience={close} onLocation={close}
        audienceLabel={t('square.audiencePublic')} locationLabel={t('square.location')} publishing={false} publishable={Boolean(value.trim())}
        progress={0} />
      : app ? <div className="external-app-panel">
        <ExternalAppIdentity logo={app.logo} title={t(app.name)} description={t(app.description)} connection="connected" />
        <ExternalAppActions>
          <ExternalAppAction icon="open_in_new" label={t(app.open)} onClick={close} />
          <ExternalAppAction icon={entry.historyKey === 'chronelle' ? 'calendar_month' : 'link_off'} label={t(app.manage)} onClick={close} />
        </ExternalAppActions>
      </div> : cover
        ? <div className="atlas-preview-cover"><img alt="" src={photo}/><div><h2>{title}</h2><p>{hint}</p></div></div>
        : entry.showTitle ? sample : <><h2 className="atlas-preview-heading">{title}</h2>{sample}</>}
    </SideDrawer>;
    return entry.fullscreen ? drawer : <FloatingDrawerScope standalone>{drawer}</FloatingDrawerScope>;
  }
  if (entry.component === 'ActionSheet') return <ActionSheet open title={title} onClose={close} actions={[
    {key: 'open', label: t('patterns.preview'), icon: <span className="material-symbols-outlined">open_in_new</span>, onSelect: close},
    {key: 'remove', label: t('common.delete'), danger: true, icon: <span className="material-symbols-outlined">delete</span>, onSelect: close},
  ]} />;
  if (entry.kind === 'sheet') return <BottomSheet open title={title} onClose={close}>{sample}</BottomSheet>;
  if (entry.component === 'AlertDialog') return <AlertDialog open title={title} description={hint} onClose={close} onConfirm={close} />;
  if (entry.component === 'ConfirmDialog') return <ConfirmDialog open title={title} description={hint} danger={entry.danger} onClose={close} onConfirm={close} />;
  if (entry.component === 'InputDialog') return <InputDialog open title={title} description={hint} value={value} onChange={setValue} onClose={close} onConfirm={close} />;
  if (entry.component === 'AsyncErrorDialog') return <AsyncErrorDialog open title={title} message={hint} onClose={close} onRetry={close} />;
  if (entry.component === 'SelectControl' || entry.component === 'SettingSelect') return <SettingsDialog open title={title} onClose={close}>
    <SelectControl label={t('menu.appearance')} value={option} options={[
      {value: 'light', label: t('atlas.light')}, {value: 'dark', label: t('atlas.dark')},
    ]} onChange={async next => {setOption(next);}} />
  </SettingsDialog>;
  if (entry.kind === 'modal') return <SettingsDialog open title={title} onClose={close}>{sample}</SettingsDialog>;
  if (entry.kind === 'media') return <MediaLightbox index={mediaIndex}
    altPrefix={title} items={[{kind: 'image', uri: photo}, {kind: 'image', uri: '/themes/christmas-2026/village.webp'}]}
    onIndexChange={setMediaIndex} onClose={close} onJumpToMessage={close} />;
  if (entry.kind === 'popover') return <section className="atlas-feedback-preview" aria-label={title}>
    <strong>{title}</strong>
    <ExternalAppActions>
      <ExternalAppAction icon="check" label={t('common.done')} onClick={close} />
      <ExternalAppAction icon="close" label={t('common.close')} onClick={close} />
    </ExternalAppActions>
  </section>;
  if (entry.kind === 'controls') return <SettingsDialog open title={title} onClose={close}>
    <SettingGroup>
      <SettingRow title={t('atlas.previewControl')} trailing={<SettingSwitch checked={enabled} label={t('atlas.previewControl')} onChange={setEnabled} />} />
    </SettingGroup>
    {sample}
  </SettingsDialog>;
  if (entry.component === 'Snackbar' || entry.component === 'AppToast') return <Snackbar open message={title}
    actionLabel={t('common.close')} onAction={close} onClose={close} />;
  return <section className="atlas-feedback-preview" aria-label={title}>
    {entry.component === 'InlineAlert' ? <InlineAlert tone={entry.tone === 'success' || entry.tone === 'error' ? entry.tone : 'info'}>{title}</InlineAlert>
      : <FeedbackState title={title} description={hint} tone={entry.tone === 'error' || entry.tone === 'loading' || entry.tone === 'empty' ? entry.tone : 'neutral'}
        action={<button type="button" className="ghost-button" onClick={close}>{t('common.close')}</button>} />}
    {entry.component === 'InlineAlert' && <OverlayIconButton icon="close" aria-label={t('common.close')} onClick={close} />}
  </section>;
}

export default function ComponentAtlasPage() {
  const {t} = useI18n();
  const [audience, setAudience] = useState<typeof overlayAudiences[number]>('member');
  const [kind, setKind] = useState<typeof overlayKinds[number] | 'all'>('drawer');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<OverlayInventoryEntry | null>(null);
  const [tone, setTone] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [theme, setTheme] = useState(() => document.documentElement.dataset.siteTheme || 'default');
  useEffect(() => {
    const root = document.documentElement;
    const previousTone = root.getAttribute('data-theme');
    const previousTheme = root.getAttribute('data-site-theme');
    root.dataset.theme = tone;
    if (theme === 'default') delete root.dataset.siteTheme;
    else root.dataset.siteTheme = theme;
    return () => {
      if (previousTone === null) delete root.dataset.theme;
      else root.dataset.theme = previousTone;
      if (previousTheme === null) delete root.dataset.siteTheme;
      else root.dataset.siteTheme = previousTheme;
    };
  }, [theme, tone]);

  const titleFor = (entry: OverlayInventoryEntry) => {
    const app = appFor(entry);
    if (app) return t(app.name);
    const translated = entry.titleKey ? t(entry.titleKey as TranslationKey) : '';
    return entry.title || (translated !== entry.titleKey && translated) || entry.historyKey || entry.component;
  };
  const search = query.trim().toLocaleLowerCase();
  const entries = inventory.filter(entry => entry.audiences.includes(audience) && (kind === 'all' || entry.kind === kind))
    .filter(entry => !search || [titleFor(entry), entry.component, entry.historyKey, entry.source].join(' ').toLocaleLowerCase().includes(search));
  const groups = new Map<string, OverlayInventoryEntry[]>();
  for (const entry of entries) {
    const key = entry.component;
    const existing = groups.get(key);
    if (existing) existing.push(entry);
    else groups.set(key, [entry]);
  }

  return <main className="component-atlas">
    <header className="atlas-header">
      <div><h1>{t('atlas.title')}</h1><p>{t('atlas.intro')}</p></div>
      <div className="atlas-theme-controls">
        <label><span>{t('menu.appearance')}</span><select value={tone} onChange={event => setTone(event.target.value)}>
          <option value="light">{t('atlas.light')}</option><option value="dark">{t('atlas.dark')}</option>
        </select></label>
        <label><span>{t('atlas.theme')}</span><select value={theme} onChange={event => setTheme(event.target.value)}>
          <option value="default">{t('atlas.default')}</option><option value="christmas-2026">{t('atlas.christmas')}</option><option value="birthday-botanical">{t('atlas.birthday')}</option>
        </select></label>
      </div>
    </header>
    <nav className="atlas-audiences" aria-label={t('atlas.audiences')}>
      {overlayAudiences.map(value => <button type="button" key={value} aria-pressed={audience === value}
        onClick={() => {setAudience(value); setKind('drawer');}}>{t(`atlas.${value}`)}</button>)}
    </nav>
    <section className="atlas-browser" aria-label={t('atlas.title')}>
      <div className="atlas-filter">
        <nav aria-label={t('atlas.types')}>{(['all', ...overlayKinds] as const).map(value => <button type="button"
          aria-pressed={value === kind} onClick={() => setKind(value)} key={value}>{t(`atlas.${value}`)}</button>)}</nav>
        <label className="atlas-search">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder={t('atlas.search')} aria-label={t('atlas.search')}/>
        </label>
      </div>
      <p className="atlas-result" aria-live="polite">{t('atlas.results', {count: entries.length})}</p>
      <div className="atlas-groups">
        {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([component, items]) => <details key={component} open={groups.size < 7 || Boolean(search)}>
          <summary>
            <span className="material-symbols-outlined" aria-hidden="true">{icons[items[0].kind]}</span>
            <strong>{component}</strong><small>{items.length}</small>
            <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
          </summary>
          <ul>{items.map(entry => <li key={entry.id}><button type="button" onClick={() => setActive(entry)}>
            <span><strong>{titleFor(entry)}</strong><small>{entry.source}</small></span>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span>
          </button></li>)}</ul>
        </details>)}
      </div>
      {!entries.length && <p className="atlas-empty">{t('atlas.empty')}</p>}
    </section>
    {active && <SurfacePreview key={active.id} entry={active} title={titleFor(active)} close={() => setActive(null)} />}
  </main>;
}
