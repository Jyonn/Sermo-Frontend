import {useI18n, type TranslationKey} from '../lib/language';

const numerals = ['一','二','三','四','五','六','七','八','九'];
const honors: Array<readonly [string, TranslationKey]> = [
  ['東','tabletop.east'], ['南','tabletop.south'], ['西','tabletop.west'], ['北','tabletop.north'],
  ['中','tabletop.redDragon'], ['發','tabletop.greenDragon'], ['白','tabletop.whiteDragon'],
];
const suits = [['萬','tabletop.characters'], ['筒','tabletop.dots'], ['索','tabletop.bamboo']] as const;
const marks = [[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8],[0,2,3,4,5,6,8],[0,1,2,3,5,6,7,8],[0,1,2,3,4,5,6,7,8]];
const honorIcons = ['east','south','west','north','local_fire_department','eco','crop_square'];

export function MahjongTile({tile, selected, drawn, disabled, onClick}: {tile: number | null; selected?: boolean; drawn?: boolean; disabled?: boolean; onClick?: () => void}) {
  const {t} = useI18n();
  if (tile === null) return <span className="mahjong-tile is-covered" aria-label={t('tabletop.coveredTile')} role="img" />;
  const face = Math.floor(tile / 4);
  const honor = honors[face - 27];
  const suitIndex = Math.floor(face / 9);
  const rank = face % 9;
  const label = honor ? t(honor[1]) : t(suits[suitIndex][1], {count:rank + 1});
  const content = honor ? <span className="mahjong-honor" aria-hidden="true">
    <i className="material-symbols-outlined">{honorIcons[face - 27]}</i>{face < 31 && <b>{honor[0]}</b>}
  </span> : suitIndex === 0 ? <><b aria-hidden="true">{numerals[rank]}</b><span aria-hidden="true">{suits[0][0]}</span></>
    : suitIndex === 2 && rank === 0 ? <i className="material-symbols-outlined mahjong-bird" aria-hidden="true">flutter_dash</i>
      : <span className={`mahjong-pips is-${suitIndex === 1 ? 'dots' : 'bamboo'}${rank === 0 ? ' is-single' : ''}`} aria-hidden="true">
        {Array.from({length:9}, (_,index) => <i key={index} data-mark={marks[rank].includes(index) || undefined} />)}
      </span>;
  const dragon = face >= 31 ? ['red','green','white'][face - 31] : undefined;
  const className = `mahjong-tile suit-${suitIndex}${dragon ? ` is-${dragon}-dragon` : ''}${drawn ? ' is-drawn' : ''}`;
  return onClick ? <button type="button" className={className} aria-pressed={selected ?? false} aria-label={label} disabled={disabled} onClick={onClick}>{content}</button>
    : <span role="img" className={className} aria-label={label}>{content}</span>;
}
