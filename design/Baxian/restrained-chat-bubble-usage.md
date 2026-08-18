# 八仙克制型动态聊天气泡 · Codex 使用说明

生产接入使用 `direct-imagegen-v4/`。其 48 帧是 ImageGen 直接生成的连续角色动作，不依赖前端平移、光流或程序插帧；旧 `restrained-*` 均仅供回溯。

## 生产素材索引

| 人物 | 自动动画 | 锚点 | 推荐尺寸 | 时长 | 动作语义 |
| --- | --- | --- | --- | --- | --- |
| 吕洞宾 | `LvDongbin/direct-imagegen-v4/animation-48.webp` | 头像框边缘 | 移动端 72px；桌面端 80px | 4s | 探身、拔剑、舞剑致意、收剑退回 |
| 钟离权 | `ZhongliQuan/direct-imagegen-v4/animation-48.webp` | 头像框边缘 | 移动端 72px；桌面端 80px | 4.5s | 费力升起、把玩抛接元宝、耸肩退回 |
| 何仙姑 | `HeXiangu/direct-imagegen-v4/animation-48.webp` | 头像框边缘 | 移动端 72px；桌面端 80px | 3.75s | 起飞、制动、侠礼、落回边缘 |

每套还包括：

- `direct-imagegen-v4/spritesheet-48.png`：8 列 × 6 行，单帧 256 × 256。
- `direct-imagegen-v4/frames/frame-01.png` 至 `frame-48.png`：用于 Canvas 或精确逐帧控制。
- `direct-imagegen-v4/animation.json`：角色独立时长、逐帧节拍、动作阶段和接入元数据。
- `restrained-12/`、`restrained-24/`、`restrained-48-v2/`：已废弃的探索；Codex 不得接入新功能。
- `animation.json`：帧时长、锚点、触发方式和低动态模式信息；接入时优先读取该文件，不要在组件里复制帧参数。
- `preview-48.gif`：严格2秒的设计审阅预览，不建议线上使用。
- `source/keyposes-chroma.png`：ImageGen 原始洋红底候选姿态板，仅供再生成和追溯。
- `source/keyposes.png`：去色键后的透明候选姿态板。

## Codex 必须遵守的接入规则

1. 将人物放在气泡容器的独立绝对定位层中，设置 `pointer-events: none`；不要把人物烘焙进九宫格气泡背景。
2. 人物层允许溢出气泡，但不得进入正文安全区。气泡正文的 padding 不因动画变化，避免文字跳动。
3. 仅当“新消息首次进入可视区”时自动播放一次。滚动离开后再回来、组件重渲染、页面恢复前台都不能再次自动播放。
4. 同一聊天视口同时最多播放一个人物；后续效果排队或直接显示静态首帧。
5. 动画完成后隐藏人物层，不保留循环动画。用户点击专用角色角标时可以重播；不要让点击整条消息触发。
6. 连续消息组只在最后一条气泡播放；小于 88px 的极窄气泡、系统消息、引用预览和错误状态不播放。
7. `prefers-reduced-motion: reduce` 时禁止自动播放，只显示 `animation.json` 指定的 `fallbackFrame`，或完全隐藏。
8. 线上优先使用动画 WebP；需要精确结束回调或 Safari 兼容控制时使用 spritesheet/frames，并根据 `durationsMs` 播放。
9. 不对素材做横向镜像。剑、元宝、发髻和衣襟具有方向性；需要另一侧锚点时重新生成对应方向版本。
10. 角色的视觉盒不得参与气泡测量、列表高度计算或虚拟列表估高。

## 推荐 DOM 结构

```tsx
<div className="message-row">
  <div className="bubble-wrap" data-character="lv-dongbin">
    <div className="message-bubble">消息正文</div>
    <img
      className="bubble-character bubble-character--top-right"
      src="/design/Baxian/LvDongbin/direct-imagegen-v4/animation-48.webp"
      alt=""
      aria-hidden="true"
    />
  </div>
</div>
```

```css
.bubble-wrap {
  position: relative;
  isolation: isolate;
  width: fit-content;
  max-width: min(78vw, 36rem);
}

.bubble-character {
  position: absolute;
  z-index: 2;
  width: clamp(64px, 5vw, 72px);
  height: clamp(64px, 5vw, 72px);
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.bubble-character--top-right {
  right: -28px;
  top: -42px;
}

@media (prefers-reduced-motion: reduce) {
  .bubble-character { display: none; }
}
```

实际偏移应按角色 `animation.json` 的 `anchor` 映射到共享定位 token，不要在三个气泡组件中分别写一套 CSS。

## 播放状态建议

```text
idle/hidden
  └─ 新消息首次进入可视区且动画队列空闲 → playing
playing
  ├─ 播放完成 → hidden，并记录 messageId 已播放
  └─ 用户离开会话 → hidden
hidden
  └─ 点击角色角标 → replaying → hidden
```

“已播放”至少按 `conversationId + messageId + effectId` 记录在当前会话内存中；是否跨会话持久化由产品决定。

## 旧版 24 帧的用途

- 不要在普通消息到达时自动播放。
- 可用于角色角标点击后的完整演出、主题预览页或购买/解锁页。
- 完整演出与12帧短动效不能同时播放。
- 用户快速连续点击时忽略后续点击，不叠加多个动画实例。

## 重新构建

源图更新后，在 `sermo-frontend` 上级目录执行：

```bash
python sermo-frontend/design/Baxian/build_direct_imagegen_v4.py
```

脚本只切分两张 ImageGen 原始 24 帧表、去除洋红底并编码产物；不会生成中间帧或改造人物动作。
