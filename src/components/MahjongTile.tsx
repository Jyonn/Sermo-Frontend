import {useI18n, type TranslationKey} from '../lib/language';

const numerals = ['一','二','三','四','五','六','七','八','九'];
const honors: Array<readonly [string, TranslationKey]> = [
  ['東','tabletop.east'], ['南','tabletop.south'], ['西','tabletop.west'], ['北','tabletop.north'],
  ['中','tabletop.redDragon'], ['發','tabletop.greenDragon'], ['白','tabletop.whiteDragon'],
];
const suits = [['萬','tabletop.characters'], ['筒','tabletop.dots'], ['索','tabletop.bamboo']] as const;

export function MahjongTile({tile, selected, drawn, disabled, onClick}: {tile: number | null; selected?: boolean; drawn?: boolean; disabled?: boolean; onClick?: () => void}) {
  const {t} = useI18n();
  if (tile === null) return <span className="mahjong-tile is-covered" aria-label={t('tabletop.coveredTile')} role="img" />;
  const face = Math.floor(tile / 4);
  const honor = honors[face - 27];
  const suitIndex = Math.floor(face / 9);
  const rank = face % 9;
  const label = honor ? t(honor[1]) : t(suits[suitIndex][1], {count:rank + 1});
  const content = honor ? <b aria-hidden="true">{honor[0]}</b>
    : <><b aria-hidden="true">{numerals[rank]}</b><span aria-hidden="true">{suits[suitIndex][0]}</span></>;
  const className = `mahjong-tile suit-${suitIndex}${face === 31 ? ' is-red-dragon' : ''}${drawn ? ' is-drawn' : ''}`;
  return onClick ? <button type="button" className={className} aria-pressed={selected ?? false} aria-label={label} disabled={disabled} onClick={onClick}>{content}</button>
    : <span role="img" className={className} aria-label={label}>{content}</span>;
}
