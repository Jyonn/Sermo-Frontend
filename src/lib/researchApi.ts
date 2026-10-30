import type { ResearchProject, ResearchResourceSpace, ResearchSummary } from "./research.ts";
import type { CalendarSetup, ResearchMeeting } from "./researchCalendar.ts";

type ResearchRequestOptions = {
  auth: true;
  method?: "POST";
  query?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

// Inject the shared transport so authentication, retries and cancellation stay centralized.
export type ResearchRequest = <T>(path: string, options: ResearchRequestOptions) => Promise<T>;

export function createResearchApi(request: ResearchRequest) {
  return {
    researchResources(id: number, taskId: string, signal?: AbortSignal) {
      return request<ResearchResourceSpace>(`/research/${id}/resources/`, { auth: true, query: { task_id: taskId }, signal });
    },
    researchResourceAction<T>(id: number, taskId: string, body: Record<string, unknown>) {
      return request<T>(`/research/${id}/resources/`, { auth: true, method: "POST", body: { ...body, task_id: taskId } });
    },
    researchList(signal?: AbortSignal) {
      return request<ResearchSummary[]>("/research/", { auth: true, signal });
    },
    researchCalendar(id: number, signal?: AbortSignal) {
      return request<CalendarSetup>(`/research/${id}/calendar/`, { auth: true, signal });
    },
    researchMeetings(id: number, signal?: AbortSignal) {
      return request<ResearchMeeting[]>(`/research/${id}/meetings/`, { auth: true, signal });
    },
    researchBookMeeting(id: number, body: Record<string, unknown>) {
      return request<ResearchMeeting>(`/research/${id}/meetings/`, { auth: true, method: "POST", body });
    },
    researchCalendarAction<T>(id: number, body: Record<string, unknown>, signal?: AbortSignal) {
      return request<T>(`/research/${id}/calendar/`, { auth: true, method: "POST", body, signal });
    },
    researchGet(id: number, signal?: AbortSignal) {
      return request<ResearchProject>(`/research/${id}/`, { auth: true, signal });
    },
    researchCreate(body: Record<string, unknown>) {
      return request<ResearchProject>("/research/", { auth: true, method: "POST", body });
    },
    researchUpdate(id: number, revision: number, body: Record<string, unknown>) {
      return request<ResearchProject>(`/research/${id}/`, { auth: true, method: "POST", body: { ...body, revision } });
    },
  };
}
