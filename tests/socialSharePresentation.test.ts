import assert from 'node:assert/strict';
import test from 'node:test';
import type {LinkPreviewDTO} from '../src/types';
import {hasSocialShareMetadata, isRepeatedShareText, socialShareCaption, socialShareTitle} from '../src/lib/socialSharePresentation.ts';

const video: LinkPreviewDTO = {
  status: 'ready',
  title: '《爱笑的眼睛》 & 《冻结》',
  url: 'https://www.douyin.com/video/7000000000000000001',
  image_url: 'https://example.test/video.jpg',
};

test('only repeated titles and bare share links are hidden in Square captions', () => {
  assert.equal(socialShareCaption('《爱笑的眼睛》＆《冻结》。', video), '');
  assert.equal(socialShareCaption(`  ${video.url}  `, video), '');
  assert.equal(socialShareCaption(`${video.title}\n${video.url}`, video), '');
  const comment = `${video.title}\n第二段改编特别好听\n${video.url}`;
  assert.equal(socialShareCaption(comment, video), comment);
  assert.equal(socialShareCaption(video.title!, {...video, status: 'pending'}), video.title);
  assert.equal(socialShareCaption(video.title!, {...video, url: 'https://example.test/collection'}), video.title);
});

test('supports gallery titles read from provider metadata and preserves distinct descriptions', () => {
  const gallery: LinkPreviewDTO = {
    status: 'ready',
    url: 'https://xhslink.cn/o/example',
    provider_data: {provider: 'xiaohongshu_gallery', title: '周末的照片', canonical_url: 'https://www.xiaohongshu.com/explore/0001'},
  };
  assert.equal(hasSocialShareMetadata(gallery), true);
  assert.equal(socialShareTitle(gallery), '周末的照片');
  assert.equal(socialShareCaption('周末的照片', gallery), '');
  assert.equal(isRepeatedShareText('周末的照片，拍于西湖。', socialShareTitle(gallery)), false);
});
