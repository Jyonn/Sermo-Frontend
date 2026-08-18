# 《八仙！》气泡系列共同字标

## 文件

- `baxian-logo-gold.png`：透明底金色纹理主标，用于主题预览、商店卡片和较大的聊天气泡。
- `baxian-logo-gold-512.png`：固定 512 × 256 画布的通用版本。
- `baxian-logo-gold-72.png`：固定 144 × 72 画布的小尺寸版本，优先用于聊天气泡角标。
- `baxian-logo-flat-gold.png`：透明底纯色金版本，用于深色模式、低对比背景或 CSS 动效遮罩。
- `source/imagegen-gold-logo.png`：ImageGen 根据正式海报提取、清理后的高分辨率源。

## 接入规则

- Logo 是吕洞宾、钟离权、何仙姑三套气泡的共同系列标识，不替代各角色动画。
- 推荐放在气泡尾部或人物锚点的对角，显示宽度 36–56px；不得进入正文安全区。
- 同一气泡只出现一次，不循环闪烁。角色播放时可将 Logo 从 0.72 淡入到 1；不做旋转、弹跳或描边跑马灯。
- 浅色背景使用纹理金版本；复杂或深色背景使用纯色金版本并加 `filter: drop-shadow(0 1px 1px rgb(60 32 8 / 28%))`。
- `prefers-reduced-motion` 下保持静态，不隐藏。
- 不使用英文副标题、上映日期、人物或海报底图。

## 重建

```bash
python design/Baxian/build_logo_assets.py
```

脚本只去除 ImageGen 源图中的伪透明棋盘背景、裁切和缩放，不重新绘制字形。
