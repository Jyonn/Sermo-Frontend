import test from 'node:test';
import assert from 'node:assert/strict';
import {squareSwipeDirection,adjacentSquareChannel} from '../src/lib/squareSwipe.ts';
test('deliberate left and right swipes select adjacent channels',()=>{
  assert.equal(squareSwipeDirection(-90,12,300,390),1);
  assert.equal(squareSwipeDirection(90,-12,300,390),-1);
  assert.equal(adjacentSquareChannel(['activities','all','friends','mine','user'],'friends',1),'mine');
  assert.equal(adjacentSquareChannel(['activities','all','friends','mine','user'],'friends',-1),'all');
});
test('vertical scrolling, small movements and long presses do not switch channels',()=>{
  assert.equal(squareSwipeDirection(50,150,300,390),null);
  assert.equal(squareSwipeDirection(30,3,200,390),null);
  assert.equal(squareSwipeDirection(80,60,300,390),null);
  assert.equal(squareSwipeDirection(30,2,1100,390),null);
});
test('a deliberate slow page drag still settles onto the neighboring channel',()=>{
  assert.equal(squareSwipeDirection(-160,8,1600,390),1);
});
test('hidden Explore is skipped and first and last channels do not wrap',()=>{
  assert.equal(adjacentSquareChannel(['activities','friends','mine'],'friends',-1),'activities');
  assert.equal(adjacentSquareChannel(['activities','friends','mine'],'activities',-1),null);
  assert.equal(adjacentSquareChannel(['activities','friends','mine'],'mine',1),null);
  assert.equal(adjacentSquareChannel(['activities','friends','mine'],'user',1),null);
});
