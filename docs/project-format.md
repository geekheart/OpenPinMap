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
    "groups": [{"connector": "H1", "start": [50,100], "gap": 70, "scale": 1, "pins": [{"name":"GND", "color":"#2ecc71"}]}]
  }
}
```

示例中的 `imageData` 是占位符；实际项目必须包含可解码的 PNG、JPEG 或 WebP 数据。兼容旧版 `openpinmap` 和 `pins-studio` 的 version 1 项目；未指定纸张的旧项目保留自定义尺寸，分组缩放默认为 1。

画布上限 8000 px / 边且总面积不超过 3200 万像素；最多 24 组、每组 300 针、合计 1000 针。坐标和间距均按原画布像素计算。预览缩放不改变排版或输出尺寸。栅格导出上限为 8000 px / 边、6400 万像素。

`imageScale` 是素材原始像素尺寸的百分比（1–500）；`imageRotation` 为 0 / 90 / 180 / 270 度，按顺时针旋转；`imageX` / `imageY` 是旋转后的素材外框左上角。旋转操作保留中心位置。组内 `scale` 是 0.1–5 倍等比缩放，作用于标签、字号及组内间距；`start` 是变换后的画布坐标，`gap` 是缩放前的间距。因此相邻标签的实际间距为 `gap × scale`。手柄缩放和拖动均写入这些字段，不会修改原素材或引脚顺序。

`paper.format` 为 `a4` 时固定为 300 DPI 的 A4 纵向 2480 × 3508 或横向 3508 × 2480；`custom` 使用项目中的宽高。`exportSettings.scale` 只影响输出像素密度，不移动图中元素；`quality` 为 JPG 和压缩 SVG 素材的编码质量，PNG 不使用此参数。

## pins_pic_gen 配置

“引脚配置 → 导入 pins_pic_gen JSON”导入原生成器配置。它只含名称、颜色、字号、坐标与间距，不含图片；当前图片会保留并合成为底图。请搭配对应产品图使用。

“标签样式 → 生成器文件”分别导出配置和底图：

```sh
python3 /path/to/pins_pic_gen/generate.py MyBoard_pins.json
```

在配置和底图所在目录执行。文件名会自动配对为 `MyBoard.png` 与 `MyBoard_pins.json`。

新导出的生成器 JSON 还含 `openpinmap` 扩展：完整 v2 项目，包括内嵌图片与所有变换。网页再次导入时优先恢复此扩展；Python 生成器忽略它。顶层 groups 将整组 scale 换算为间距和字号，以便原 generate.py 使用。

页面使用 Canvas，原 Python 工具使用 Pillow，字体度量和抗锯齿可能存在差异。原脚本使用全局字号作为标签内边距，无法精确复现各组不同的缩放比例；自定义圆角、引线也由原脚本自己的规则处理。精确恢复网页排版请使用完整项目 JSON，精确导出外观请使用网页 PNG/SVG/JPG。A4 导出按纸张裁切越界内容，原脚本可按自身规则扩展 X 区域。
