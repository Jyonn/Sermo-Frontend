import {Link} from 'react-router-dom';
import {AppChrome} from './AppChrome';
import {TabPageHeader} from './TabPageHeader';
import {useI18n} from '../lib/language';
import {useSpaceFeatures} from '../lib/spaceFeatures';
import './FeatureUnavailablePage.css';

export function FeatureUnavailablePage({title}:{title:string}) {
  const {t}=useI18n();
  const features=useSpaceFeatures();
  return <AppChrome title={title} hideTopbar shellClassName="desktop-tab-shell"><section className="page-stack"><TabPageHeader title={title}/><div className="feature-unavailable" role="status"><span className="material-symbols-outlined" aria-hidden="true">door_front</span><h1>{t('feature.unavailable',{feature:title})}</h1><p>{t('feature.availableElsewhere')}</p><nav><Link className="secondary-button" replace to="/app/menu">{t('feature.backMenu')}</Link>{features.chatEnabled?<Link className="primary-button" replace to="/app/chats">{t('nav.chats')}</Link>:null}</nav></div></section></AppChrome>;
}
