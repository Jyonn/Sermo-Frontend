export function insertMarkdown(body: string, start: number, end: number, before: string, after: string, fallback: string) {
  const selected = body.slice(start, end) || fallback;
  return { body: body.slice(0, start) + before + selected + after + body.slice(end), start: start + before.length, end: start + before.length + selected.length };
}
export function markdownTable(columns: number, rows: number, heading: string) {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || columns > 10 || rows < 1 || rows > 10) throw new Error('Invalid table size');
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return '\n' + [line(Array.from({length:columns}, (_,i) => `${heading} ${i+1}`)), line(Array(columns).fill('---')), ...Array.from({length:rows-1},()=>line(Array(columns).fill(' ')))].join('\n') + '\n';
}
