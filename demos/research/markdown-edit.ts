export function insertMarkdown(body: string, start: number, end: number, before: string, after: string, fallback: string) {
  const selected = body.slice(start, end) || fallback;
  return { body: body.slice(0, start) + before + selected + after + body.slice(end), start: start + before.length, end: start + before.length + selected.length };
}
