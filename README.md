# screeps-world-printer

[![DRAW_OFFICAL](https://github.com/HoPGoldy/screeps-world-printer/actions/workflows/DRAW_OFFICAL.yml/badge.svg?event=schedule)](https://github.com/HoPGoldy/screeps-world-printer/releases)
[![npm](https://img.shields.io/npm/v/screeps-world-printer)](https://www.npmjs.com/package/screeps-world-printer)

screeps-world-printer 是一个简单且支持自定义的 screeps 游戏地图绘制工具。

特性：

- 🎁 基于 ts 开发，完整的类型支持
- ⚡ 支持局部更新的本地缓存，提高绘制速度
- 🛒 支持绘制官服及私服
- 🔨 极其灵活的自定义配置

> 本项目将以每日两次的频率绘制官服地图（运行于 [Github Action](https://github.com/HoPGoldy/screeps-world-printer/actions)，使用 [示例脚本](https://github.com/HoPGoldy/screeps-world-printer/tree/main/example)），你可以在 [screeps-world-printer - releases](https://github.com/HoPGoldy/screeps-world-printer/releases) 找到最终的绘制成果。

## 安装

使用 npm：

```
npm i sharp screeps-world-printer
```

使用 yarn：

```
yarn add sharp screeps-world-printer
```

## 如何使用

传入要绘制的服务器连接信息进行实例化，需要填写自己的 token。然后调用 `drawWorld` 方法即可：

```js
const { ScreepsWorldPrinter } = require('screeps-world-printer');

const connectInfo = {
    host: 'https://screeps.com/',
    token: 'your-token-here',
    shard: 'shard3'
}

const printer = new ScreepsWorldPrinter(connectInfo);

printer.drawWorld();
```

随后将会在控制台显式如下输出，最后在指定目录下生成绘制好的地图：

```bash
开始绘制 https://screeps.com/ shard3 的世界地图
正在加载地图尺寸
正在获取世界信息
正在下载素材
下载进度 ======================================== 100% 14884/14884
正在绘制地图
拼接进度 ======================================== 100% 14884/14884
正在保存结果
绘制完成，结果已保存至 D:\screeps-world-printer\.screeps-world-printer\dist\shard3_2021-9-9_13-2-40.png
```

*在第一次绘制时，将会下载并缓存所有的地图瓦片及玩家头像，之后的绘制将会使用这些缓存来加快绘制速度（玩家头像会在变更时自动更新）。*

## 绘制私服

通过传入服务器地址及玩家名和密码即可连接到私服并进行绘制。

```js
const { ScreepsWorldPrinter } = require('screeps-world-printer');

const connectInfo = {
    host: 'http:127.0.0.1:21025',
    username: 'player-name-here',
    password: 'player-password-here'
}

const printer = new ScreepsWorldPrinter(connectInfo);

printer.drawWorld();
```

注意，被绘制的私服需要 **安装过 [screepsmod-auth](https://github.com/ScreepsMods/screepsmod-auth) 并设置过玩家密码**。

## 绘制局部房间

由于 screeps 服务器可以自行增减房间，并且没有提供 api 来获取当前可用的所有房间名，所以我们需要一个“垫片”来对不同的服务器进行适配，在本项目中称其为“房间名解析器”。

**房间名解析器是一个异步函数，接受世界地图的尺寸（来自服务器 api）并返回二维房间名数组**，我们可以通过实例化时传入第二个参数来指定房间名解析器，或者在实例化之后通过 `setRoomNameGetter` 方法设置新的解析器：

```js
const roomNameGetter = async ({ width, height }) => {
    console.log(width, height);

    return [
        ['W0N0', 'E0N0'],
        ['W0S0', 'E0S0']
    ]
}

const printer = new ScreepsWorldPrinter(connectInfo, roomNameGetter);
// 或者
printer.setRoomNameGetter(roomNameGetter);

printer.drawWorld();
```

在执行 `drawWorld` 时，会将地图的尺寸传递给房间名解析器来获取具体的房间名二维数组。而最后生成的地图就是以这个二维数组为基础进行绘制的，例如上面的例子中，将会绘制 2*2 的世界中心四房地图。

当然，返回的房间名数组的限制相当宽松，不需要按照顺序，甚至不需要是个房间名，当传入 `undefined` 时，绘制器将会跳过并留空，例如如下的房间名解析器：

```js
const roomNameGetter = async () => [
    ['W0N0', undefined, 'E0N0'],
    [undefined, 'E2S0', undefined],
    ['E2S3', undefined, 'E4N0'],
];
```

将绘制一个这样的地图（黑色为默认的背景颜色）：

[![hqqyOP.png](https://z3.ax1x.com/2021/09/09/hqqyOP.png)](https://imgtu.com/i/hqqyOP)

---

当不提供房间名解析器时，将根据提供的服务器连接信息来自动选择默认的解析器，本工具包中内置了两个解析器，分别为：

- `getCentrosymmetricRoomNames`: 生成四象限地图房间名，当连接到官服时默认使用
- `getDefaultServerRoomNames`：生成默认私服房间名（以右下角为原点 W0N0 的 WN 象限），当连接到私服时默认使用

在一般情况下默认提供的解析器都可以正常工作，但是也有例外，像 `ScreepsPlus` 这种大型私服，使用默认的私服解析器就会出现问题，这时可以手动指定解析器或者使用自己的解析器：

```js
const { ScreepsWorldPrinter, getCentrosymmetricRoomNames } = require('screeps-world-printer');

// screepspls 是和官服一样的四象限布局，所以可以使用官服的默认解析器
const printer = new ScreepsWorldPrinter(connectInfo, getCentrosymmetricRoomNames);

printer.drawWorld();
```

## 自定义绘制

如果你想在绘制的时候加入一些自己的想法，则可以在实例化之后通过 `setDrawer` 方法来设置你自己的绘制器。同时，我们也通过 `defaultRoomDrawer` 暴露了默认的绘制器，也就是说，下面这种写法等同于没写：

```js
const { ScreepsWorldPrinter, defaultRoomDrawer } = require('screeps-world-printer');

const connectInfo = { /** ... */ };

const printer = new ScreepsWorldPrinter(connectInfo);

// 设置默认绘制器
printer.setRoomDrawer(defaultRoomDrawer);

printer.drawWorld();
```

**roomDrawer 绘制器是一个异步函数，接受绘制素材并返回一个 Buffer。** 在执行绘制时将会对每一个房间执行一遍该方法，并将返回的 buffer 当作图像添加到最终的成果图上。那么现在的问题就是，什么是绘制素材呢？

简单来说，绘制素材是一个对象，其类型声明如下（点击其中的类型名来查看详细介绍）：

```ts
/**
 * 房间绘制素材
 */
interface DrawMaterial {
    /**
     * 房间名称
     */
    roomName: string
    /**
     * 房间信息
     */
    roomInfo: RoomInfo
    /**
     * 获取该房间地图瓦片
     */
    getRoom: () => Promise<Buffer>
    /**
     * 获取该房间的拥有者头像
     */
    getBadge?: () => Promise<Buffer>
    /**
     * 获取头像边框
     */
    getBadgeBorder?: GetBadgeBorderFunc
    /**
     * 获取正方形图层蒙版
     */
    getMask: GetMaskFunc
}
```

其中 `roomInfo` 包含了从服务器获取到关于本房间的相关信息，而 `getRoom`、`getBadge`、`getMask` 则分别用于获取房间地形瓦片、玩家头像（如果没有玩家占领则为 undefined）、头像边框以及支持的蒙版（例如房间未开放或者新手区蒙版）。

你可以按照你的想法进行绘制，这里推荐使用 [sharp](https://sharp.pixelplumbing.com/) 进行操作（本项目的内部也使用了 `sharp`），例如下面是一个给所有房间添加小爱心的示例：

```js
const { ScreepsWorldPrinter, defaultRoomDrawer } = require('screeps-world-printer');
const sharp = require('sharp');

const connectInfo = { /** ... */ };

const heart = Buffer.from('<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1631173047331" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2150" width="32" height="32" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"></style></defs><path d="M923 283.6c-13.4-31.1-32.6-58.9-56.9-82.8-24.3-23.8-52.5-42.4-84-55.5-32.5-13.5-66.9-20.3-102.4-20.3-49.3 0-97.4 13.5-139.2 39-10 6.1-19.5 12.8-28.5 20.1-9-7.3-18.5-14-28.5-20.1-41.8-25.5-89.9-39-139.2-39-35.5 0-69.9 6.8-102.4 20.3-31.4 13-59.7 31.7-84 55.5-24.4 23.9-43.5 51.7-56.9 82.8-13.9 32.3-21 66.6-21 101.9 0 33.3 6.8 68 20.3 103.3 11.3 29.5 27.5 60.1 48.2 91 32.8 48.9 77.9 99.9 133.9 151.6 92.8 85.7 184.7 144.9 188.6 147.3l23.7 15.2c10.5 6.7 24 6.7 34.5 0l23.7-15.2c3.9-2.5 95.7-61.6 188.6-147.3 56-51.7 101.1-102.7 133.9-151.6 20.7-30.9 37-61.5 48.2-91 13.5-35.3 20.3-70 20.3-103.3 0.1-35.3-7-69.6-20.9-101.9z" p-id="2151" fill="#d81e06"></path></svg>');

const roomNameGetter = async () => [
    ['W0N0', 'E0N0'],
    ['W49S9', 'E0S0'],
];

const printer = new ScreepsWorldPrinter(connectInfo, roomNameGetter);

// 设置默认绘制器
printer.setRoomDrawer(async material => {
    // 调用默认绘制器生成房间图像
    const result = await defaultRoomDrawer(material);

    // 把爱心叠加到左上角
    const heartBeats = sharp(result).composite([{
        input: heart,
        top: 10,
        left: 10,
        blend: 'atop'
    }]);

    // 生成并返回 buffer
    return await heartBeats.toBuffer();
});

printer.drawWorld();
```

将会绘制出如下地图：

[![4dCG1e.png](https://z3.ax1x.com/2021/09/23/4dCG1e.png)](https://imgtu.com/i/4dCG1e)

## 自定义保存

和自定义绘制类似，你可以通过 `Screeps-world-printer` 实例上的 `setResultSaver` 方法设置最终的结果图像保存行为。

`setResultSaver` 接受一个 **异步函数，这个函数接受最后的地图图像 Buffer 作为参数**，你可以在这里将其保存到其他地方，或者传递出去进行其他处理。

```js
const { ScreepsWorldPrinter } = require('screeps-world-printer');

const printer = new ScreepsWorldPrinter({ /** ... */ });

printer.setResultSaver(resultBuffer => {
    // 保存到目标位置或者进行后续操作
});
```



但是需要注意的是，一旦设置了 resultSaver，默认的保存行为将会覆盖，所以如果你想要将其保存到默认位置的话，可以调用 `getDefaultSaver` 来获取默认保存器：

```js
printer.setResultSaver(resultBuffer => {
    // 干一些自己想干的事...

    // 获取默认的保存器，将会将结果保存至 .screeps-world-printer/dist/
    const saver = getDefaultSaver(connectInfo);
    return await saver();
});

// 下面这种写法等同于没写
printer.setResultSaver(getDefaultSaver(connectInfo));
```

注意需要向 `getDefaultSaver` 传入服务器连接信息，它会生成对应的保存函数。

## 设置回调

`ScreepsWorldPrinter` 继承自 `EventEmitter`，并提供了 `addPrintListener` 方法来更方便、更类型化的监听事件：

```js
const { ScreepsWorldPrinter, PrintEvent } = require('screeps-world-printer');

const printer = new ScreepsWorldPrinter({ /** ... */ });

// 添加事件监听
printer.addPrintListener({
    [PrintEvent.BeforeFetchSize]: (host, shard) => console.log('获取服务器地图尺寸之前'),
    [PrintEvent.AfterFetchSize]: () => console.log('获取服务器地图尺寸之后'),
    [PrintEvent.BeforeFetchWorld]: (mapSize) => console.log('获取服务器房间信息之前'),
    [PrintEvent.AfterFetchWorld]: () => console.log('获取服务器房间信息之后'),
    [PrintEvent.BeforeDownload]: (roomStats) => console.log('下载绘制素材之前'),
    [PrintEvent.Download]: (material) => console.log('单个房间素材下载完成'),
    [PrintEvent.AfterDownload]: () => console.log('所有绘制素材下载完成之后'),
    [PrintEvent.BeforeDraw]: (dataSet) => console.log('开始绘制之前'),
    [PrintEvent.Draw]: (material) => console.log('单个房间绘制完成'),
    [PrintEvent.AfterDraw]: () => console.log('地图绘制完成之后'),
    [PrintEvent.BeforeSave]: (result) => console.log('保存之前'),
    [PrintEvent.AfterSave]: (savePath) => console.log('保存之后')
});

printer.drawWorld();
```

通过以上方法注册的事件回调均可通过 `.off` 方法注销：

```js
const listener = (host, shard) => console.log('获取服务器地图尺寸之前')

// 注册监听
printer.addPrintListener({
    [PrintEvent.BeforeFetchSize]: listener
});

// 移除监听
printer.off(PrintEvent.BeforeFetchSize, listener);
```

## 保持静默

你可以通过如下两个 api 关闭和开启日志输出：

```js
const printer = new ScreepsWorldPrinter(connectInfo);

// 关闭控制台输出
printer.silence();

// 开启控制台输出
printer.talkative();
```

## 仅获取素材而不进行绘制

默认调用 `drawWorld` 方法后，将会下载素材，然后调用房间绘制器和保存器完成后续操作。如果你有别的想法，只需要用到素材而不需要进行绘制的话，那么可以调用 `fetchWorld` 来替代 `drawWorld` 方法。

`fetchWorld` 方法将会返回一个 **绘制素材对象二维数组，结构和房间名解析器返回的二维数组格式相同**。你可以使用这些素材完成更灵活的操作，例如开发一个 web 服务器，做一个在线的可交互地图之类的。

## 完全自定义

如果你想完全的自定义的话，没问题，`ScreepsWorldPrinter` 实例暴露了 `service` 和 `cache` 两个属性，这两者分别提供了地图绘制相关的服务器 api 接口以及对本地缓存的管理。你可以以此为基础开发你自己的绘制功能。