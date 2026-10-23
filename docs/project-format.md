# 文件格式

## 完整项目

“保存项目”下载 `<名称>.openpinmap.json`，包含图片与排版，可直接通过“打开项目”恢复。

```json
{
  "format": "openpinmap",
  "version": 2,
  "state": {
    "name": "MyBoard",
    "width": 2480,
    "height": 3508,
    "paper": {"format": "a4", "orientation": "portrait", "dpi": 300},
    "exportSettings": {"format": "png", "scale": 1, "quality": 90, "optimizeSvg": true, "smoothing": true},
    "background": "transparent",
    "fontSize": 36,
    "fontFamily": "Arial",
    "radius": 100,
    "guides": false,
    "imageX": 300,
    "imageY": 100,
    "imageScale": 100,
    "imageRotation": 0,
    "imageName": "board.png",
    "imageData": "data:image/png;base64,...",
    "palette": {"gpio": "#3498db", "power": "#e74c3c", "ground": "#2ecc71"},
    "groups": [{"connector": "H1", "layout": "horizontal", "textDirection": "horizontal", "labelRotation": 90, "rotation": 0, "mirrorX": false, "mirrorY": false, "start": [50,100], "gap": 70, "scale": 1, "pins": [{"name":"GND", "color":"#2ecc71"}]}]
  }
}
```

示例中的 `imageData` 是占位符；实际项目必须包含可解码的 PNG、JPEG 或 WebP 数据。兼容旧版 `openpinmap` 和 `pins-studio` 的 version 1 项目；未指定纸张的旧项目保留自定义尺寸，分组缩放默认为 1，排布方向默认为 `vertical`。

画布上限 8000 px / 边且总面积不超过 3200 万像素；最多 24 组、每组 300 针、合计 1000 针。坐标和间距均按原画布像素计算。预览缩放不改变排版或输出尺寸。栅格导出上限为 8000 px / 边、6400 万像素。

`imageScale` 是素材原始像素尺寸的百分比（1–500）；`imageRotation` 为 0 / 90 / 180 / 270 度，按顺时针旋转；`imageX` / `imageY` 是旋转后的素材外框左上角。旋转操作保留中心位置。组内 `scale` 是 0.1–5 倍等比缩放，作用于标签、字号及组内间距；`start` 始终是全部变换后整组外框左上角的画布坐标，`gap` 是缩放前沿组排列轴的间距。因此相邻标签沿该轴的实际间距为 `gap × scale`。手柄缩放和拖动均写入这些字段，不会修改原素材或引脚顺序。

每组独立保存以下字段，不根据 `groups` 数量自动推断：

| 字段 | 取值与含义 |
| --- | --- |
| `layout` | `vertical`（缺省）沿组本地 Y 轴排列标签；`horizontal` 沿组本地 X 轴排列标签，只决定组内排列方向。 |
| `textDirection` | `horizontal` 为正常横排文字；`vertical` 为逐字从上到下竖排，独立于 `layout`。旧项目没有此字段时，`layout: "horizontal"` 沿用竖排文字，其余沿用横排文字，以保留原有外观。 |
| `labelRotation` | 0（缺省）/ 90 / 180 / 270 度，按顺时针将每个胶囊与文字一起旋转；例如 `layout: "horizontal"`、`textDirection: "horizontal"`、`labelRotation: 90` 形成一排竖直胶囊，文字整体转向。 |
| `rotation` | 0（缺省）/ 90 / 180 / 270 度，按顺时针旋转整组。 |
| `mirrorX` / `mirrorY` | 布尔值，缺省均为 `false`。绕组中心，关于组本地 X 轴反射 Y 坐标，或关于组本地 Y 轴反射 X 坐标，字形也一起反射。整组旋转为 0° 时，X 轴镜像上下翻转，Y 轴镜像左右翻转。 |

在界面切换 `layout`、`textDirection` 或 `labelRotation` 时，按旧主轴标签尺寸计算非负净空，再将 `gap` 更新为新主轴标签尺寸加原净空（仍限制在 1–2000 px）；原本重叠的净空视为 0。直接输入针距、拖动间距手柄和导入已有配置仍使用明确指定的 `gap`。较长的分组可通过整组缩放或画布尺寸容纳。

标签与整组旋转、镜像操作均保留组中心。可将上下侧设为横排、左右侧保留纵排，以排布四面引脚。中点手柄沿变换后的组排列轴调整间距，旋转后仍可使用。纵排支持顶端 / 居中 / 底端对齐；横排支持左端 / 居中 / 右端对齐。保存导入与语言切换保留以上设置；Canvas 预览与 PNG、JPG、SVG 导出使用相同的排布和变换规则。

`paper.format` 为 `a4` 时固定为 300 DPI 的 A4 纵向 2480 × 3508 或横向 3508 × 2480；`custom` 使用项目中的宽高。`exportSettings.scale` 只影响输出像素密度，不移动图中元素；`quality` 为 JPG 和压缩 SVG 素材的编码质量，PNG 不使用此参数。

## pins_pic_gen 配置

“引脚配置 → 导入 pins_pic_gen JSON”导入原生成器配置。它只含名称、颜色、字号、坐标与间距，不含图片；当前图片会保留并合成为底图。请搭配对应产品图使用。

“标签样式 → 生成器文件”分别导出配置和底图：

```sh
python3 /path/to/pins_pic_gen/generate.py MyBoard_pins.json
```

在配置和底图所在目录执行。文件名会自动配对为 `MyBoard.png` 与 `MyBoard_pins.json`。

新导出的生成器 JSON 还含 `openpinmap` 扩展：完整 v2 项目，包括内嵌图片、各组排列、文字方向、标签与整组旋转及镜像。网页再次导入时优先恢复此扩展；Python 生成器忽略它。顶层 groups 将整组 scale 换算为间距和字号，以便原 generate.py 使用；原脚本无法复现横排标签、逐字竖排文字、标签旋转及整组旋转和镜像。

页面使用 Canvas，原 Python 工具使用 Pillow，字体度量和抗锯齿可能存在差异。原脚本使用全局字号作为标签内边距，无法精确复现各组不同的缩放比例；自定义圆角、引线也由原脚本自己的规则处理。精确恢复网页排版请使用完整项目 JSON，精确导出外观请使用网页 PNG/SVG/JPG。A4 导出按纸张裁切越界内容，原脚本可按自身规则扩展 X 区域。
