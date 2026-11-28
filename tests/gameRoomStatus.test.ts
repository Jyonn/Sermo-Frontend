import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cardTableStatus, duelRoomStatus} from '../src/lib/gameRoomStatus.ts';
import type {LandlordTableView} from '../src/lib/landlord.ts';
import type {DuelMatch} from '../src/lib/numberDuel.ts';
import type {FourPlayerTable} from '../src/lib/tabletop.ts';

test('table versions track updates without treating another player’s move as your turn', () => {
  const table = {
    status: 'playing', version: 3, turn: 1, your_seat: 0,
    seats: [{position: 0, trustee: false, doubled: null}],
  } as LandlordTableView;
  assert.deepEqual(cardTableStatus(table), {phase: 'playing', revision: 3});
  assert.deepEqual(cardTableStatus({...table, turn: 0, version: 4}), {phase: 'turn', revision: 4});
  assert.equal(cardTableStatus({...table, status: 'doubling'}).phase, 'turn');
  assert.equal(cardTableStatus({...table, status: 'finished', can_start: true}).phase, 'start');
  assert.equal(cardTableStatus({...table, status: 'abandoned'}).phase, 'closed');
});

test('Mahjong highlights an available claim and honors trustee mode', () => {
  const table = {
    status: 'playing', your_seat: 1,
    seats: [{position: 1, trustee: false}],
    board: {turn: 2, pending: {choices: [{kind: 'hu'}]}},
  } as FourPlayerTable;
  assert.equal(cardTableStatus(table).phase, 'turn');
  assert.equal(cardTableStatus({...table, seats: [{...table.seats[0], trustee:true}]}).phase, 'playing');
});

test('a duel detects peer progress and round completion without using clock time as an update', () => {
  const match = {status: 'secrets', round: 1, own_secret: '1234', guesses: [], opponent_locked: false} as unknown as DuelMatch;
  const original = duelRoomStatus(match);
  assert.equal(original.phase, 'playing');
  assert.equal(duelRoomStatus({...match, deadline: 200}).revision, original.revision);
  assert.notEqual(duelRoomStatus({...match, opponent_locked: true}).revision, original.revision);
  assert.equal(duelRoomStatus({...match, status: 'playing'}).phase, 'turn');
  assert.equal(duelRoomStatus({...match, status: 'finished', outcome: 'win'}).phase, 'finished');
});
