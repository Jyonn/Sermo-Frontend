import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceAsset} from '../src/lib/appearanceAsset.ts';
import manifest from '../src/lib/appearanceAssetManifest.json' with {type:'json'};
test('all appearance aliases resolve to immutable cloud API resources across mirrors',()=>{
  for(const [alias,uri] of Object.entries(manifest)){
    assert.match(uri,/^https:\/\/api\.sermo\.jyonn\.space\/resources\/assets\/\d+\/display\/[a-f0-9]{64}$/);
    assert.equal(appearanceAsset(alias),uri);
    assert.equal(appearanceAsset('https://frienden.6-79.cn'+alias),uri);
  }
  assert.equal(appearanceAsset('https://other.example/assets/a.png'),'https://other.example/assets/a.png');
});
test('dynamic wallpaper layer names resolve without public files',()=>{
  assert.match(appearanceAsset('/assets/frienden-wallpapers/layers/night/actors/sleeping-dog.png'),/^https:/);
  assert.match(appearanceAsset('/assets/frienden-wallpapers/layers/garden/plants/sunflower.png'),/^https:/);
});
