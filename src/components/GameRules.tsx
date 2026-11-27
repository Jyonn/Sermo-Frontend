import {useState} from 'react';
import {useI18n, type TranslationKey} from '../lib/language';
import type {CardGame} from '../lib/cardPatterns';
import {PlayingCard} from './PlayingCards';
import {MahjongTile} from './MahjongTile';

const RANKS = [0,4,8,12,16,20,24,28,32,36,40,44,48,52,53];
const CARD_EXAMPLES: Array<{label: TranslationKey; cards: number[]; games?: CardGame[]}> = [
  {label:'game.examplePair',cards:[12,13]},
  {label:'game.exampleStraight',cards:[4,8,12,16,20]},
  {label:'game.examplePairs',cards:[4,5,8,9,12,13]},
  {label:'game.exampleTriple',cards:[8,9,10,16],games:['landlord']},
  {label:'game.examplePlane',cards:[0,1,2,4,5,6],games:['landlord']},
  {label:'game.exampleBomb',cards:[16,17,18,19]},
  {label:'game.exampleRocket',cards:[52,53],games:['landlord']},
  {label:'game.exampleWild',cards:[16,17,18,19,53],games:['firefight']},
  {label:'game.exampleChain',cards:[0,1,2,3,4,5,6,7,8,9,10,11],games:['firefight']},
  {label:'game.exampleRoyal',cards:[52,53,106,107],games:['classic','firefight']},
];

export function CardRuleGuide({game}: {game: CardGame}) {
  const {t} = useI18n();
  const [preview,setPreview] = useState<CardGame>(game);
  const mode = game === 'landlord' ? game : preview;
  return <div className="game-rule-guide">
    <h3>{t('game.rankOrder')}</h3>
    <div className="game-card-ranks" aria-label={t('game.rankOrder')} role="group">
      {RANKS.map(id => <PlayingCard key={id} id={id} />)}
    </div>
    <h3>{t('game.cardExamples')}</h3>
    {game !== 'landlord' && <div className="game-rule-modes" role="group" aria-label={t('landlord.rules')}>
      {(['classic','firefight'] as const).map(choice => <button key={choice} type="button" aria-pressed={mode === choice}
        onClick={() => setPreview(choice)}>{t(choice === 'classic' ? 'tabletop.classicShuangkou' : 'tabletop.firefight')}</button>)}
    </div>}
    <div className="game-rule-examples">
      {CARD_EXAMPLES.filter(entry => !entry.games || entry.games.includes(mode)).map(({label,cards}) => <div key={label}>
        <b>{t(label)}</b><div>{cards.map(id => <PlayingCard key={id} id={id} />)}</div>
      </div>)}
    </div>
    <p>{t('game.handGesture')}</p>
  </div>;
}

const TILE_EXAMPLES: Array<[TranslationKey,number[]]> = [
  ['game.exampleChi',[36,40,44]], ['game.examplePong',[124,125,126]],
  ['game.exampleKong',[72,73,74,75]], ['game.exampleEye',[128,129]],
];

export function MahjongRuleGuide() {
  const {t} = useI18n();
  return <div className="game-rule-guide">
    <h3>{t('game.tileFamilies')}</h3>
    <div className="game-tile-families">{[[0,4,8],[36,40,44],[72,76,80],[108,112,116,120,124,128,132]].map(tiles => <div key={tiles[0]}>
      {tiles.map(tile => <MahjongTile key={tile} tile={tile} />)}
    </div>)}</div>
    <h3>{t('game.tileExamples')}</h3>
    <div className="game-rule-examples">
      {TILE_EXAMPLES.map(([label,tiles]) => <div key={label}>
        <b>{t(label)}</b><div>{tiles.map(tile => <MahjongTile key={tile} tile={tile} />)}</div>
      </div>)}
    </div>
    <p>{t('game.meldExample')}</p>
  </div>;
}

export function DuelRuleGuide() {
  const {t} = useI18n();
  return <div className="game-rule-guide">
    <h3>{t('game.duelExample')}</h3>
    <div className="game-duel-example">
      <b>{t('game.duelSecret')}</b><div>{[0,1,2,3].map((digit,index) => <span key={digit} className={index % 2 === 0 ? 'is-exact' : ''}>{digit}</span>)}</div>
      <b>{t('game.duelGuess')}</b><div>{[0,5,2,7].map((digit,index) => <span key={digit} className={index % 2 === 0 ? 'is-exact' : ''}>{digit}</span>)}</div>
    </div>
    <p>{t('game.duelFeedback')}</p>
  </div>;
}
