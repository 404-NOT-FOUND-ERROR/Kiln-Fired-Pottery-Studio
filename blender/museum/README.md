# 藏品 · Blender 场景与材质试作

第一版实际三维场景，以 `design-concepts/museum-mood-v1.png` 为美术参考。没有将概念图贴成背景，也没有将生图中的陶器作为成品。

## 查看

- `museum-final.png`：1920×1080 主视图，Cycles 渲染。
- `glaze-detail.png`：1280×1280 釉面特写。
- `review.html`：将真实渲染图放进简洁的网页排版，供评审构图；不是实时三维体验页。
- `museum-scene.blend`：Blender 3.1 可打开的完整可编辑场景。
- `scene-manifest.json`：版本、采样、相机与资源记录。

沿用项目的 `node serve.cjs`，访问 `/blender/museum/review.html` 可查看排版预览。

实时交互版本已接入根页面 `/?preview=1`。`export_web.py` 从现有场景导出共享 UV 的小罐、低面数石台阴影接收网格、釉色 / 裂纹 / 法线 / 粗糙度贴图、无主体的展厅底图和现场 HDR 探针。脚本不会覆盖源 `.blend`。`pack_web_textures.py` 用 Pillow 压缩为浏览器加载的 WebP。

```sh
blender --background --factory-startup --python-exit-code 1 --python export_web.py
python pack_web_textures.py
```

只重烘材质时末尾添加 `-- --bake-only`；完整导出还会重渲染两组底图与反射探针。

## 场景内容

集合按主体陶器、粗石展台、展厅空间、背景展品、光影、机位分组。陶器具备内壁、口沿、底足与 GlazeUV；裂纹、色斑、铁质微点与釉面凹凸均由可编辑节点生成。主体底部贴合石台中央的平整落脚区域。

展台是变形后的真实网格，带分层矿物材质。背景包含展厅墙体、展龛、陈列陶器、枝条和原创水墨图案。两张背景纸本贴图已打包进 `.blend` 文件；可单独复制场景文件打开，无需联网或安装插件。

默认启用 Cycles / OptiX；制作机为 NVIDIA RTX 2060。若另一台机器不支持 OptiX，可在 Blender 的渲染设置切换 CPU。主视图和特写相机均保留。

## 重建

`build_museum.py` 可在 Blender 后台执行，`--draft` 生成 1280×720、40 samples 的低成本试片；默认生成 1920×1080、160 samples 的主图和特写并保存场景。

```sh
blender --background --factory-startup --python build_museum.py -- --draft
blender --background --factory-startup --python build_museum.py
```

`make_panel_textures.py` 使用 Pillow、numpy 生成背景的原创纸本图案；现有 PNG 已包含在 `textures/` 中，重建场景无需先重跑它。

## 当前边界

这是场景与陶器材质的第一次 Blender 实作，并非生图概念的像素级复刻。示例陶器使用程序釉色，尚未连接用户在网页上的绘制纹理。网页实时版本仍需进行材质烘焙、几何减面、环境反射与阴影匹配；不会把 Cycles 的效果直接等同于网页渲染效果。

釉色与开片是美术表达，未用真实釉料数据校准，不代表特定烧成条件一定产生此种结果。
