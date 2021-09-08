# 如何使用

本文件夹下共包含三个示例：

## 绘制官方服务器地图（drawOffical）

在项目根目录下执行如下命令并传入你的官服 token，将会默认绘制 shard3 的世界地图：

```
npx ts-node example/drawOffical.ts --files --token=令牌
```

你也可以通过传入 `--shard=` 参数的方式指定要绘制的目标地图，如：

```
npx ts-node example/drawOffical.ts --files --token=令牌 --shard=shard0
```

开始绘制后将会依次打印如下内容并在绘制完成后展示保存路径：

```bash
开始绘制 https://screeps.com/ shard3 的世界地图
正在加载地图尺寸
正在获取世界信息
正在下载素材
下载进度 ======================================== 100% 14884/14884
正在绘制地图
拼接进度 ======================================== 100% 15006/14884
正在保存结果
绘制完成，结果已保存至 D:\project\screeps-world-printer\.screeps-world-printer\dist\shard3_2021-8-5_17-50-25.png
```

## 绘制私服地图（drawPrivate）

在项目根目录下执行如下命令并传入你的官服 token，将会默认绘制本地私服（使用 steam 客户端一键启动或 npm 安装的私服）的世界地图，注意，**服务器要事先安装过 [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth) 并设置过玩家密码**：

```bash
npx ts-node example/drawPrivate.ts --files --username=玩家名 --password=密码
```

你也可以通过传入 `--host=` 的形式指定要绘制的服务器，但是主要要选择对应的 roomName 解析器。

## 绘制所有地图瓦片（drawAllTileType）

当在本地执行过绘制之后，将会在 `.screeps-world-printer/cache` 下找到已经存在的缓存，你可以随便找一个地图瓦片（以 `.png` 结尾）和一个头像（以 `.svg` 结尾），并使用 `--tile` 和 `--badge` 按如下形式传入脚本：

```bash
npx ts-node example/drawAllTileType.ts \
--files \
--tile=W49S9.83bd365232eb6526550330d4a6ddbdf2.png \
--badge=HoPGoldy.d1da0c788ad2f613177a6a2dd68771e3.svg
```

随后将会绘制出所有风格的房间瓦片，一般用于自定义房间绘制器后查看绘制情况：

[![hbk76O.md.png](https://z3.ax1x.com/2021/09/08/hbk76O.md.png)](https://imgtu.com/i/hbk76O)