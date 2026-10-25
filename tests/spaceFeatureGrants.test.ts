import test from 'node:test';
import assert from 'node:assert/strict';
import { spaceFeatureGrants, spaceFeatureGrantState } from '../src/lib/spaceFeatureGrants.ts';
import type { PlatformAdminSpaceDTO } from '../src/types.ts';

test('each capability requires its own explicit grant before it can report enabled', () => {
  for (const feature of spaceFeatureGrants) {
    const space = { [feature.enabled]: true } as unknown as PlatformAdminSpaceDTO;
    assert.equal(spaceFeatureGrantState(space, feature), 'management.featureNotGranted');
    space[feature.granted] = true;
    assert.equal(spaceFeatureGrantState(space, feature), 'management.featureEnabled');
    space[feature.enabled] = false;
    assert.equal(spaceFeatureGrantState(space, feature), 'management.featurePending');
    for (const other of spaceFeatureGrants.filter(item => item.key !== feature.key)) {
      assert.equal(spaceFeatureGrantState(space, other), 'management.featureNotGranted');
    }
  }
});
