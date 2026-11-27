import {useEffect, useState} from 'react';
import {api} from '../lib/api';
import type {GameRanking, GameRankingMetric} from '../lib/gameLeaderboard';
import {useI18n} from '../lib/language';
import {SettingsDialog} from './SettingsDialog';
import {UserAvatar} from './UserAvatar';
import './GameLeaderboard.css';

export function GameLeaderboard({activityKey, open, onClose, scoredOnly}: {
  activityKey: string; open: boolean; onClose: () => void; scoredOnly?: boolean;
}) {
  const {t} = useI18n();
  return <SettingsDialog open={open} title={t('landlord.ranking')} onClose={onClose}>
    {open && <Ranking key={activityKey} activityKey={activityKey} scoredOnly={scoredOnly} />}
  </SettingsDialog>;
}

function Ranking({activityKey, scoredOnly}: {activityKey: string; scoredOnly?: boolean}) {
  const {t, language} = useI18n();
  const [year, setYear] = useState<number>();
  const [metric, setMetric] = useState<GameRankingMetric>('points');
  const [data, setData] = useState<GameRanking>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    setFailed(false);
    void api.getGameLeaderboard(activityKey, year, metric, request.signal).then(result => {
      if (!request.signal.aborted) setData(result);
    }).catch(() => {if (!request.signal.aborted) setFailed(true);});
    return () => request.abort();
  }, [activityKey, year, metric, attempt]);

  const waiting = !data || data.metric !== metric || (year !== undefined && year !== data.year);
  const percent = new Intl.NumberFormat(language, {style:'percent', maximumFractionDigits:1});
  const format = (row: {points: number; win_rate: number}) => metric === 'points'
    ? t('landlord.points', {count:row.points}) : percent.format(row.win_rate);

  return <div className="game-ranking">
    {data && <header>
      <span>{t('landlord.rankPolicy')}{scoredOnly && <small>{t('game.scoredRankPolicy')}</small>}</span>
      <select aria-label={t('landlord.rankYear')} value={year ?? data.year} onChange={event => setYear(Number(event.target.value))}>
        {data.years.map(value => <option key={value} value={value}>{t('landlord.yearLabel', {year:value})}</option>)}
      </select>
    </header>}
    <div className="game-rank-tabs" role="group" aria-label={t('landlord.ranking')}>
      {(['points','win_rate'] as const).map(value => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)}>
        {t(value === 'points' ? 'landlord.pointsBoard' : 'landlord.winRateBoard')}
      </button>)}
    </div>
    {failed ? <div className="game-rank-empty"><p>{t('landlord.rankFailed')}</p>
        <button className="ghost-button" onClick={() => setAttempt(value => value + 1)} type="button">{t('common.retry')}</button></div>
      : waiting ? <p className="game-rank-empty" role="status">{t('common.loading')}</p>
      : !data.rows.length ? <p className="game-rank-empty">{t('landlord.noRanks')}</p>
      : <>
        {data.mine && <p className="game-rank-mine">{t('landlord.myRank', {rank:data.mine.rank, score:format(data.mine)})}</p>}
        <ol>{data.rows.map(row => <li key={row.member.user_id}>
          <span className="game-rank-number">{row.rank}</span>
          <UserAvatar className="game-rank-avatar" name={row.member.name} uri={row.member.avatar_uri} />
          <b>{row.member.name}</b><span className="game-rank-result">{format(row)}
            <small>{t('landlord.winRecord', {wins:row.wins, games:row.games})}</small></span>
        </li>)}</ol>
      </>}
  </div>;
}
