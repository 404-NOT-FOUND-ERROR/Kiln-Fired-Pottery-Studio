# 色场场景

`art-scene.blend` 可直接在 Blender 中编辑，已用 Blender 3.1 / Cycles 验证。场景包含与藏品一致的小罐、连续赭红绒面曲面、靛蓝织物、暖金纸质圆面、薄石台、扫描风化岩石、干枝与三台校准相机。构图参考 `design-concepts/art-mood-v1.png`。

从项目根目录重建，`blender` 可替换为本机可执行文件的路径：

```sh
blender --background --factory-startup --python-exit-code 1 --python blender/art/build_art.py
blender --background --factory-startup --python-exit-code 1 --python blender/art/bake_glaze.py
blender --background --factory-startup --python-exit-code 1 --python blender/art/export_web.py
python blender/art/pack_web_textures.py
```

压缩脚本需要 Pillow；优先使用已配置的 Python 环境。构建脚本可以追加 `-- --draft` 渲染低分辨率草图，或 `-- --no-render` 只保存场景。渲染时自动使用可用的 OptiX 设备，未找到时使用 CPU。

石台顶面与侧面分开建模和着色：顶面保持磨平，侧面使用细碎的真实几何孔隙、缺口与照片纹理。前景采用风化岩石扫描网格及其 UV 材质；赭红与靛蓝使用绒面照片纹理，地面使用细矿物颗粒。贴图在 `textures/`，岩石模型及贴图在 `models/rock_09/`；编辑场景时保留这些相对目录。来源和许可见 [素材说明](SOURCES.md)。

`bake_glaze.py` 在与画笔一致的弧长 UV 上烘焙 2048 像素的示例灰青釉、粗糙度和法线。它只用于色场的示例成品，用户自行施釉的颜色仍来自自己的釉层；离开色场或进入观察室时恢复共用釉面。`export_web.py` 导出时隐藏小罐，并生成三组没有陶器与陶器投影的 2560×1440 干净底图、石台接收网格、现场 HDR 与机位清单。HDR 包含两个矩形反射板，以增加釉面的大片反光。`pack_web_textures.py` 将底图与釉面压缩到 `assets/art/`，法线和粗糙度采用无损 WebP。网页只需要该目录和共用的陶器资产，不请求外部素材。`web-renders/` 与 `web-bakes/` 保存原始输出，`art-final.png` 为完整离线效果参考。

Blender 的 Z 向上坐标转换为网页 Y 向上；网页相机和底图使用同一个裁切窗口。石台顶面为 0.43，小罐脚底严格落在同一平面，其他器形按各自包围盒对齐。全貌机位降低以减少石台的俯视感。全貌与俯视对焦于器物，特写使用独立的 72 mm 镜头与前肩对焦；网页为实际施釉网格补充景深。

实时投影采用本场景独立的圆盘采样柔化，不改变其他场景的阴影配置。布景保持固定，可旋转器物、有限缩放与切换机位。HDR 与网页光源用于接近 Cycles 的反光，两个渲染器的材质与色彩转换仍有差别。
