# 工坊素坯与图像 / 模型结合

`bisque-workshop.blend` 保存真实的内壁、口沿、底部与干燥素坯材质节点。模型沿用小罐的弧长 UV，因此前期施釉和出窑展示使用相同的表面坐标。未烧成模型添加浅拉坯痕迹与微小形变，区别于光滑的釉面样品。

底图为 `assets/workshop/workshop-background.webp`。网页以固定相机对齐底图与实时模型；旋转保持底图不动，缩放同步改变底图裁切和实时模型取景。绘制发生在模型上，图像中没有示例器物或界面文字。

素坯底色为 2048²，法线由 2048² 烘焙缩至 1536²，粗糙度和遮蔽为 1024²。法线、粗糙度和遮蔽的 WebP 使用无损压缩。光照代理包含左侧漫射窗、暖木桌和灰泥墙；HDR 用于现场色调匹配，它不是由原图重建出的实测 HDR。

重建：

```sh
blender --background --factory-startup --python-exit-code 1 --python blender/workshop/build_bisque.py
python blender/workshop/pack_bisque.py
```

输出到 `assets/workshop/`，原始 PNG 保留在 `bakes/`。脚本不会修改已接受的藏品、窗边和色场源场景。

这是从已素烧、尚未施釉的器物开始的体验；成型与首次素烧不在交互流程内。坯色、孔隙和烧成变化仍属艺术化示意。
