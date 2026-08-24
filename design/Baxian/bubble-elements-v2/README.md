# 八仙气泡边缘元素 v2

这组素材将角色配饰与系列印章彻底拆开。旧版 `shared-seals/` 保持不变，新气泡可以分别控制配饰和印章的位置、层级与显隐。

## 素材

| 角色 | 独立配饰 | 不规则印章 | 角色色 |
| --- | --- | --- | --- |
| 吕洞宾 | `lv-dongbin-sword-*.png` | `lv-dongbin-blue-baxian-seal-*.png` | 靛蓝 |
| 钟离权 | `zhongli-quan-jade-vase-*.png` | `zhongli-quan-red-baxian-seal-*.png` | 朱红 |
| 何仙姑 | `he-xiangu-black-douli-*.png` | `he-xiangu-pink-baxian-seal-*.png` | 莲粉 |

每项包含：

- `128.png`：聊天列表和普通气泡的首选版本；
- `512.png`：高 DPR、大尺寸预览或后续再加工；
- `source/*-imagegen.png`：ImageGen 原始 RGBA 文件。

所有文件均为真实透明背景。配饰已经带轻微倾斜，接入时不要再叠加大角度旋转。

## 推荐摆放

- 配饰放在气泡边缘外侧，约 35%–45% 压住边框；使用 `pointer-events: none` 和 `aria-hidden="true"`。
- 剑适合贴近长边或右上角，建议显示宽度 `44–68px`。
- 玉净瓶适合落在下角或短边，建议显示宽度 `38–56px`。
- 黑斗笠适合压住上边缘，建议显示宽度 `52–76px`。
- “八仙”印章只承担系列识别，建议显示宽度 `34–48px`，与配饰错开，避免同时占据同一角。
- 小气泡可只显示印章；空间充足时再显示配饰。不要让装饰参与气泡内容宽高计算。

示例：

```css
.baxian-bubble { position: relative; }
.baxian-bubble__prop,
.baxian-bubble__seal {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  user-select: none;
}
.baxian-bubble__prop { inset-inline-end: -22px; inset-block-start: -24px; width: 56px; }
.baxian-bubble__seal { inset-inline-start: -15px; inset-block-end: -17px; width: 42px; }
```

最终位置应按左右消息方向镜像，并在窄气泡上通过容器查询隐藏配饰，只保留印章。

## 宝物变印章动画

`transitions/` 提供三条 16 帧变换动画：

- `lv-dongbin/`：剑势顺时针旋转，靛蓝剑风收束，印章斜向落定；
- `zhongli-quan/`：玉净瓶带重量摇摆，朱红旋云包裹，印章下压落定；
- `he-xiangu/`：黑斗笠轻旋，聊天气泡同款浅粉薄纱风环内折，缩为不规则浅粉小印。

每个角色目录包含：

- `frames/frame-01.png` 至 `frame-16.png`：固定 `256×256` RGBA 帧；
- `spritesheet.png`：`4×4`、`1024×1024` 透明精灵表；
- `animation.webp`：透明循环审阅文件；
- `animation.json`：逐帧时长、总时长和动作说明；
- `source/imagegen-sheet.png`：ImageGen 原始透明动作表。

推荐按 `animation.json` 的非均匀时长单次播放，总长约 `1.05s`，播完停在第 16 帧。`animation.webp` 用于快速审阅；产品代码应读取逐帧 PNG 或 spritesheet，以便可靠地只播放一次并保持最终印章状态。动画固定在气泡边缘锚点，不要再对序列添加水平位移。
