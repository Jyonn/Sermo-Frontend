# Spider-Man: Brand New Day 探索页横幅

## 成品

- `assets/explore-banner-coming-soon-2160x720.webp`：推荐的 3× 前端资源，含“敬请期待”。
- `assets/explore-banner-coming-soon-1080x360.webp`：1× 轻量资源，含“敬请期待”。
- `assets/explore-banner-background-2160x720.webp`：无字背景，供前端使用翻译键叠加文案。
- 同名 PNG 用于设计检查和后续再编辑。

## 视觉与裁切

- 画幅：3:1，主尺寸 2160×720。
- 视觉锚点：右侧的红色战衣、黑色蜘蛛徽记与连帽外套；左侧为标题安全区。
- “敬请期待”固定在右下安全区。响应式裁切时请保留右侧 33% 和左侧标题区，不建议使用 `object-fit: cover` 裁成窄于 2.4:1 的比例。
- 海报参考文件只用于本项目内部设计溯源；上线前应确认已获得相应电影宣传素材的使用授权。

## 前端建议

优先使用无字背景，并通过现有 i18n 翻译键渲染标题和状态：

```tsx
<section className="relative aspect-[3/1] overflow-hidden rounded-2xl">
  <img
    src="/campaigns/spider-man-4/explore-banner-background-2160x720.webp"
    alt=""
    className="absolute inset-0 h-full w-full object-cover"
  />
  <div className="absolute bottom-[7.4%] right-[4.6%]">
    {t('campaign.spiderMan4.comingSoon')}
  </div>
</section>
```

## 再生成

脚本依赖 `sharp`：

```bash
/Users/jyonn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node build.mjs
```

生成方式：官方公开海报母版的确定性裁切、调色、排版与响应式导出。ImageGen 的两次生成尝试均在输出阶段被服务拦截，因此成品没有混入未经检查的生成画面。
