import test from 'node:test';
import assert from 'node:assert/strict';
import { emailPreviewDocument } from '../src/lib/emailPreview.ts';

test('legacy Markdown is rendered without exposing markup or executing HTML', () => {
  const result = emailPreviewDocument('markdown', '## 未读消息\n**小满**\n> \\[表情包\\]\n<script>alert(1)</script>');
  assert.match(result, /<h2>未读消息<\/h2>/);
  assert.match(result, /<strong>小满<\/strong>/);
  assert.match(result, /<blockquote>\[表情包\]<\/blockquote>/);
  assert.ok(!result.includes('<script>'));
  assert.match(result, /default-src 'none'/);
});

test('HTML preserves the email layout while plain text stays escaped', () => {
  assert.ok(emailPreviewDocument('html', '<table><tr><td>消息</td></tr></table>').includes('<table>'));
  assert.ok(emailPreviewDocument('text', '<img src=x>').includes('&lt;img src=x&gt;'));
});
