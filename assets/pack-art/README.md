# 扩展包原图来源

这些 PNG 是游戏卡包纹理，未进行 AI 生成或改绘。获取日期：2026-10-26，运行时从本地加载。为统一表格中的视觉左边缘，源图仅做透明画布对齐：保留原始卡包像素、不缩放不裁主体，将可见主体左边界统一到 x=5，并统一透明画布为 256×327；通用 `pack-stack.png` 不参与处理。

Firestone 使用原图地址 `https://static.firestoneapp.com/cardPacks/256/{boosterId}.png`。此路径来自公开的 `Zero-to-Heroes/firestone` 项目 `libs/collection/view/src/lib/packs/pack-stat-view.component.ts` 与 `libs/legacy/feature-shell/src/lib/libs/packs/components/pack-history-item.component.ts`。

卡包 ID 来自公开 npm 包 `@firestone-hs/reference-data@3.0.219` 的 `dist/enums/booster-type.js`，并已核对下载文件确为 PNG。

| 系列 | 普通图 | 金色图 |
| --- | --- | --- |
| 安戈洛龟途 THE_LOST_CITY | 982.png | 1040.png |
| 穿越时间流 ACROSS_THE_TIMEWAYS | 989.png | 1055.png |
| 黑暗帝国的统治 REIGN_OF_THE_BLACK_EMPIRE | 1057.png | 1058.png |
| 漫游翡翠梦境 INTO_THE_EMERALD_DREAM | 975.png | 990.png |
| 标准 STANDARD_PACK | 713.png | 716.png |

2026-10-26 补全原库所有 38 个扩展包与类型组合的映射，资源编号见 `src/packs/pack-assets.js`。包括十职业包、年度包、紫罗兰监狱、大地的裂变、胜地历险记、沉没之城等。旧库简称（翡翠梦境、贫瘠之地、暴风城、纳斯利亚堡、威兹班历险记）只在显示层映射，不修改历史名称。新增 PNG 均从上述 Firestone 路径下载并校验 PNG 文件头。

`pack-stack.png` 为通用卡包堆图，来自 HearthSim / Hearthstone-Deck-Tracker 的 `Hearthstone Deck Tracker/Resources/pack_stack.png`，用于全部系列或未知自定义名称。异画金色包尚无核实的专属包图，使用对应系列金色包图并显示“异画”文字角标。改名后的已知系列沿用原始素材名称。

Hearthstone 图形和纹理版权归 Blizzard Entertainment；版权说明沿用上游 `licenses/Hearthstone.md`。
