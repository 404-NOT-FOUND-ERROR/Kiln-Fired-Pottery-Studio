# 窗边 · 午后陈列场景

以 `design-concepts/living-mood-v1.png` 的木窗、枝叶投影、麻布与旧木桌为构图参考，沿用藏品场景已确认的小罐及釉面材质。场景为可编辑的 Blender 几何与程序材质，不使用概念图里的陶器替代用户作品。

## 查看

- `living-scene.blend`：完整可编辑场景，Blender 3.1。
- `living-final.png`：1920×1080 Cycles 离线成片。
- `living-draft.png`：迭代试片。
- `web-renders/window-full.png`、`window-above.png`、`window-detail.png`：去掉主体及其投影的三组场景图，各自对应独立机位。
- 实时交互入口：`http://127.0.0.1:4173/?preview=1&scene=living`。

麻布包含起伏网格、两组交织纤维和散开的边缘线；木窗、树枝和叶片投射实际阳光阴影。原木、灰泥、茶杯与树叶均保留程序材质。现场 HDR 探针供网页釉面反射使用。

枝条集中在陶器左后方，根部收拢在小花瓶的瓶口内部，在口沿以上散开；构建时对贝塞尔曲线采样，验证枝条没有穿过瓶颈。木窗的竖料、横料使用各自的顺向细纹，格栅交叉处分开表面深度，并采用圆角与加权法线。

窗外使用分层的独立叶片与细枝，近处树冠用于投射疏密不同的真实叶影。木料增加擦拭后的反光变化；麻布采用更细的交织纤维和舒缓褶皱；灰泥、茶杯与叶片各有细微表面起伏。摄影机对焦在陶器前肩，窗外、小花瓶和前景按实际距离虚化。

## 重建

从项目根目录执行：

```sh
blender --background --factory-startup --python-exit-code 1 --python blender/living/build_living.py
blender --background --factory-startup --python-exit-code 1 --python blender/living/export_web.py
python blender/living/pack_web_textures.py
```

首条命令末尾可添加 `-- --draft`，生成 1600×900 试片。需保留 `blender/museum/museum-scene.blend`，构建时从中复用已确认的小罐及材质；导出的 `living-scene.blend` 可独立打开，无需外部贴图或插件。默认 Cycles / OptiX，支持 GPU 的制作机器上验证；不支持时可切换 CPU。

## 网页实现

`assets/living/` 包含三张 WebP 场景图、现场 HDR、桌面和麻布的阴影接收网格、叶影投射网格及精确机位。陶器几何、绘制 UV 与釉面纹理继续共用藏品资产。网页固定摄影机，拖动只旋转器物，机位与底图同步裁切；支持有限缩放、特写、俯视、当前角度导出及本地收藏恢复。

釉面特写采用斜侧稍俯机位，不再裁切放大全貌底图。`living-optics.js` 根据实时陶器的深度、镜头与对焦距离计算柔和散焦；底图保留 Cycles 景深与原有颜色。场景沿用藏品的归一化尺寸，光圈参数按该尺度做视觉校准。导出同样经过景深处理，茶碗、梅瓶会按器形调整陶器前肩的对焦位置。`npm run test:optics` 验证散焦作用于实时几何、底图和釉色保留，以及渲染状态恢复。

网页陶器接收现场枝叶的实时投影，桌面仅接收陶器自己的投影，避免把底图已有的叶影再叠加一次。Three.js r161 的阴影绘制使用观察摄影机的层过滤，叶片通过逐阴影摄影机的深度材质过滤保持两组投影分开。

实时着色与 Cycles 离线渲染存在差异，浏览器内没有自由绕房间移动或真实布料模拟。釉色与烧成表现仍为艺术化工艺科普示意。
