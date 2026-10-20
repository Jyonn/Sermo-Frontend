import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePageActive } from "../lib/pageActivity";
import { agendaDay, fetchAgenda, normalizeAgenda, publicCalendarForFriend, type AgendaEvent } from "../lib/chronelleAgenda";
import { CalendarAvailabilityBar, useCalendarClock } from "./CalendarAvailabilityBar";

export function ChatCalendarAvailability({ peerId }: { peerId: number }) {
  const { session } = useAuth();
  const activePage = usePageActive();
  const now = useCalendarClock();
  const day = agendaDay(now);
  const dayKey = day.getTime();
  const minute = Math.floor(now.getTime() / 60000);
  const scope = `${session?.user.space_id}:${session?.user.user_id}:${peerId}:${dayKey}`;
  const [data, setData] = useState<{ scope: string; events: AgendaEvent[] } | null>(null);

  useEffect(() => {
    if (!session || !peerId || !activePage) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    // The existing friends-only response carries public calendar IDs. An old
    // direct chat is not proof of friendship, and no read key is ever requested.
    void api.getFriends(controller.signal).then(async (friends) => {
      const calendarId = publicCalendarForFriend(friends, peerId);
      if (!calendarId) return null;
      const start = new Date(dayKey);
      const params = new URLSearchParams({ share: calendarId, start: start.toISOString(), end: agendaDay(start, 1).toISOString() });
      return normalizeAgenda(await fetchAgenda(params, controller.signal));
    }).then((events) => {
      if (active && !controller.signal.aborted) setData(events ? { scope, events } : null);
    }).catch(() => { if (active) setData(null); }).finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [session?.accessToken, scope, peerId, dayKey, minute, activePage]);

  if (!data || data.scope !== scope) return null;
  return <CalendarAvailabilityBar compact events={data.events} day={day} now={now} />;
}
