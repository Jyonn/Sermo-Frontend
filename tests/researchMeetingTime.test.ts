import assert from 'node:assert/strict';
import { test } from 'node:test';
import { meetingRangeFromFields, meetingTimeFields, newMeetingRange } from '../src/lib/researchMeetingTime.ts';

test('a new meeting begins on the next half hour in the selected time zone', () => {
  const range = newMeetingRange(Date.parse('2026-11-26T06:06Z'), 'Asia/Shanghai');
  assert.deepEqual(meetingTimeFields(range), {
    from: '2026-11-26', to: '2026-11-26', startTime: '14:30', endTime: '15:00',
  });
  assert.deepEqual(meetingRangeFromFields(meetingTimeFields(range), range.timezone, false), range);
});

test('all-day events display the inclusive end date and send the following midnight', () => {
  const range = {
    start: '2026-11-25T16:00:00.000Z', end: '2026-11-27T16:00:00.000Z',
    timezone: 'Asia/Shanghai', all_day: true,
  };
  const fields = meetingTimeFields(range);
  assert.equal(fields.from, '2026-11-26');
  assert.equal(fields.to, '2026-11-27');
  assert.deepEqual(meetingRangeFromFields(fields, range.timezone, true), range);
});

test('rejects reversed dates and times that do not exist during daylight saving changes', () => {
  const fields = { from: '2026-03-08', to: '2026-03-08', startTime: '02:30', endTime: '04:00' };
  assert.throws(() => meetingRangeFromFields(fields, 'America/New_York', false), RangeError);
  assert.throws(() => meetingRangeFromFields({ ...fields, endTime: '01:45' }, 'Asia/Shanghai', false), RangeError);
});
