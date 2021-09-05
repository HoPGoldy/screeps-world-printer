# 如何使用

本文件夹下共包含三个示例

## 绘制官方服务器地图

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

## 绘制私服地图

## 绘制所有地图瓦片（测试展示）