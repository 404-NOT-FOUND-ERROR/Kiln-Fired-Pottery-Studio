# 色场素材来源

构图及氛围参考本项目的 `design-concepts/art-mood-v1.png`。赭红曲面、金色圆面、砂土地面、石台及枝果由 `build_art.py` 构建，陶器沿用藏品模型。釉面为程序化艺术材质，未作为真实陶瓷物性数据使用。

以下素材来自 Poly Haven，使用其 [CC0 许可](https://polyhaven.com/license)。保留来源便于后续编辑和追溯。扫描素材只进入本地 Blender 源文件与渲染结果，网页无需访问 Poly Haven。

| 素材 | 作者 | 本项目用途 |
| --- | --- | --- |
| [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) | Dimitrios Savva、Rico Cilliers | 浅色石台照片纹理，顶面与侧面采用不同的细节强度 |
| [Clay Plaster](https://polyhaven.com/a/clay_plaster) | Amal Kumar | 暖色细矿物地面 |
| [Scuba Suede](https://polyhaven.com/a/scuba_suede) | colormass、Rico Cilliers | 赭红与靛蓝色场的绒面微纹理 |
| [Rock 09](https://polyhaven.com/a/rock_09) | Jenelle van Heerden | 前景风化岩石，2K glTF 扫描网格及本地纹理 |

岩石 glTF 的模型与贴图为原始源资产，材质在构建时调成哑光暖炭色，使用两组不同姿态和比例。石台及色场纹理在构建时调色、按物理尺寸投射，微起伏采用位移纹理的凹凸映射。
