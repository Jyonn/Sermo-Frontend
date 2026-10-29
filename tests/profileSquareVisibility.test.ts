import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/UserProfilePanel.tsx',import.meta.url),'utf8');
test('profile Square entries wait for enabled space features',()=>{
  assert.match(source,/squareEnabled = features.ready && features.squareEnabled/);
  assert.match(source,/{squareEnabled && <button className="button user-profile-statements-action"/);
  assert.match(source,/{squareEnabled && <button className={`user-profile-recent-statement/);
  assert.match(source,/{squareEnabled && <button className={statementReminder/);
});
test('disabled Square cancels post fetching and clears displayed cached posts',()=>{
  assert.match(source,/if \(!squareEnabled\) {\s*recentStatementRef.current = null;\s*setRecentStatement\(null\)/);
  assert.match(source,/recentReload, squareEnabled\]/);
  assert.match(source,/kind === "statement" && !squareEnabled/);
});
