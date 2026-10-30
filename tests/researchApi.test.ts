import assert from "node:assert/strict";
import test from "node:test";
import { createResearchApi, type ResearchRequest } from "../src/lib/researchApi.ts";

test("research API retains authentication, cancellation and server routes", async () => {
  const calls: Array<{ path: string; options: Parameters<ResearchRequest>[1] }> = [];
  const response = {};
  const request: ResearchRequest = async <T>(path: string, options: Parameters<ResearchRequest>[1]) => {
    calls.push({ path, options });
    return response as T;
  };
  const api = createResearchApi(request);
  const signal = new AbortController().signal;
  const results = await Promise.all([api.researchList(signal), api.researchGet(7, signal), api.researchResources(7, "task-a", signal), api.researchCalendar(7, signal), api.researchMeetings(7, signal)]);
  assert.deepEqual(calls.map(({ path }) => path), ["/research/", "/research/7/", "/research/7/resources/", "/research/7/calendar/", "/research/7/meetings/"]);
  calls.forEach(({ options }) => {
    assert.equal(options.auth, true);
    assert.equal(options.signal, signal);
    assert.equal(options.method, undefined);
  });
  assert.deepEqual(calls[2].options.query, { task_id: "task-a" });
  results.forEach((result) => assert.equal(result, response));
});

test("research writes preserve revision authority and task scope without mutating caller bodies", async () => {
  const calls: Array<{ path: string; options: Parameters<ResearchRequest>[1] }> = [];
  const request: ResearchRequest = async <T>(path: string, options: Parameters<ResearchRequest>[1]) => {
    calls.push({ path, options });
    return {} as T;
  };
  const api = createResearchApi(request);
  const signal = new AbortController().signal;
  const body = { action: "save", revision: 1, task_id: "other" };
  await api.researchCreate(body);
  await api.researchUpdate(7, 9, body);
  await api.researchResourceAction(7, "task-a", body);
  await api.researchCalendarAction(7, body, signal);
  await api.researchBookMeeting(7, body);
  assert.deepEqual(calls.map(({ path }) => path), ["/research/", "/research/7/", "/research/7/resources/", "/research/7/calendar/", "/research/7/meetings/"]);
  calls.forEach(({ options }) => {
    assert.equal(options.auth, true);
    assert.equal(options.method, "POST");
  });
  assert.deepEqual(calls[1].options.body, { ...body, revision: 9 });
  assert.deepEqual(calls[2].options.body, { ...body, task_id: "task-a" });
  assert.equal(calls[3].options.signal, signal);
  assert.deepEqual(body, { action: "save", revision: 1, task_id: "other" });
});

test("research methods preserve the shared transport rejection", async () => {
  const error = new Error("revision conflict");
  const promise = Promise.reject(error);
  const api = createResearchApi((() => promise) as ResearchRequest);
  const result = api.researchUpdate(7, 9, { action: "save" });
  assert.equal(result, promise);
  await assert.rejects(result, (caught) => caught === error);
});
