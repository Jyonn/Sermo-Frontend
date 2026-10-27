import test from 'node:test';
import assert from 'node:assert/strict';
import { insertMarkdown, markdownTable } from '../../src/lib/researchMarkdownEdit.ts';
test('formatting preserves text around the selected range', () => {
  assert.deepEqual(insertMarkdown('abc def', 4, 7, '**', '**', 'Text'), {body:'abc **def**', start:6, end:9});
});
test('empty selection inserts and selects a placeholder', () => {
  assert.deepEqual(insertMarkdown('', 0, 0, '[', '](https://example.com)', 'Link'), {body:'[Link](https://example.com)', start:1, end:5});
});
test('multiline selection remains intact inside code fences', () => {
  assert.equal(insertMarkdown('a\nb', 0, 3, '```\n', '\n```', 'Text').body, '```\na\nb\n```');
});
test('table dimensions include the header and exclude the delimiter row',()=>{
  const lines=markdownTable(4,3,'Column').trim().split('\n');
  assert.equal(lines.length,4);
  assert.ok(lines.every(line=>line.split('|').length===6));
  assert.equal(markdownTable(10,10,'Column').trim().split('\n').length,11);
});
test('table picker rejects out of range dimensions',()=>{
  for(const [x,y] of [[0,1],[11,1],[1,11],[1,0],[1.5,2]])assert.throws(()=>markdownTable(x,y,'Column'));
});
