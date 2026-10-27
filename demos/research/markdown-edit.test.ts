import test from 'node:test';
import assert from 'node:assert/strict';
import { insertMarkdown } from './markdown-edit.ts';
test('formatting preserves text around the selected range', () => {
  assert.deepEqual(insertMarkdown('abc def', 4, 7, '**', '**', 'Text'), {body:'abc **def**', start:6, end:9});
});
test('empty selection inserts and selects a placeholder', () => {
  assert.deepEqual(insertMarkdown('', 0, 0, '[', '](https://example.com)', 'Link'), {body:'[Link](https://example.com)', start:1, end:5});
});
test('multiline selection remains intact inside code fences', () => {
  assert.equal(insertMarkdown('a\nb', 0, 3, '```\n', '\n```', 'Text').body, '```\na\nb\n```');
});
