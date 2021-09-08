import { createHash } from 'crypto';
import { ensureDir } from 'fs-extra';
import path from 'path';
import { Sharp } from 'sharp';
import { DEFAULT_RETRY_TIME, DIST_PATH, RETRY_INTERVAL } from './constant';
import { MapSize, MapStatsResp, ResultSaver, RoomStatus, ServerConnectInfo } from './type';

/**
 * 将地图视作一个中心对称的四象限布局来获取其房间名
 * （即像官服那样的地图）
 *
 * @param mapSize 地图尺寸
 * @returns 房间名二维数组
 */
export const getCentrosymmetricRoomNames = async function ({ height, width }: MapSize): Promise<string[][]> {
    if (height % 2 !== 0 || width % 2 !== 0) {
        throw new Error(`四象限布局需要地图尺寸为偶数，但是接收的地图尺寸为：height ${height} width ${width}`);
    }

    const xSectors = [
        ...Array.from({ length: width / 2 }).map((_, x) => `W${x}`).reverse(),
        ...Array.from({ length: width / 2 }).map((_, x) => `E${x}`)
    ];

    const ySectors = [
        ...Array.from({ length: height / 2 }).map((_, x) => `N${x}`).reverse(),
        ...Array.from({ length: height / 2 }).map((_, x) => `S${x}`)
    ];

    return ySectors.map(yRoomName => xSectors.map(xRoomName => xRoomName + yRoomName));
};

/**
 * 获取 steam 版 screeps 启动的默认服务器的房间名数组
 * 即只生成 WN 象限，右下角为原点 W0N0
 */
export const getDefaultServerRoomNames = async function ({ height, width }: MapSize): Promise<string[][]> {
    const xSectors = Array.from({ length: height }).map((_, x) => `W${x}`).reverse();
    const ySectors = Array.from({ length: width }).map((_, x) => `N${x}`).reverse();

    return ySectors.map(yRoomName => xSectors.map(xRoomName => xRoomName + yRoomName));
};

/**
 * 错误重试包装器
 *
 * @param {async function} asyncFunc 要包装的异步函数
 * @param {number} defaultRetryTime 默认的重试次数
 * @param {number} retryInterval 重试间隔时常
 * @returns 会自动进行错误重试的异步函数
 */
export const retryWrapper = function <T>(
    asyncFunc: (...args: any[]) => Promise<T>,
    defaultRetryTime = DEFAULT_RETRY_TIME,
    retryInterval = RETRY_INTERVAL
): (...args: any[]) => Promise<T> {
    let retryTime = defaultRetryTime;

    const retryCallback = async function (...args: any[]): Promise<T> {
        try {
            return await asyncFunc(...args);
        }
        catch (e) {
            if (retryTime <= 0) throw e;

            // console.log(`${args} 查询失败，正在重试(${DEFAULT_RETRY_TIME - retryTime}/${DEFAULT_RETRY_TIME})`)
            retryTime -= 1;
            await new Promise(resolve => setTimeout(resolve, retryInterval, true));
            return await retryCallback(...args);
        }
    };

    return retryCallback;
};

/**
 * 给图片添加透明度
 * 由于 sharp.ensureAlpha 只会为没有透明通道的图片添加透明通道
 * 当一个图片已经有透明通道时是无法使用该方法调整透明度的
 * 这里用的方法来自 @see https://github.com/lovell/sharp/issues/618#issuecomment-532293211
 *
 * @param sharp 要添加的图片
 * @param opacity 透明度 0 - 255，255 是完全不透明
 * @returns 添加透明度之后的图片
 */
export const addOpacity = function (sharp: Sharp, opacity = 128): Sharp {
    return sharp.composite([{
        input: Buffer.from([255, 255, 255, opacity]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in'
    }]);
};

/**
 * 优化房间状态
 *
 * 游戏接口返回的只有正常和未激活两种状态
 * 绘制之前会根据 novice 和 respawnArea 属性来为此字段添加是否为新手区和重生区状态
 *
 * 目前尚不清楚新手区和重生区的渲染规则
 * 下面的判断仅为观察官服显示效果做出的推断
 *
 * @param roomStats 从服务器获取的房间状态
 */
export const fixRoomStats = function (roomStats: MapStatsResp): void {
    const nowTimestamp = new Date().getTime();

    // 遍历所有房间数据进行优化
    for (const roomName in roomStats.stats) {
        const roomInfo = roomStats.stats[roomName];

        if (!roomInfo || roomInfo.status === RoomStatus.Inactivated) continue;

        // 存在新手区并且还没有结束，设置为新手区状态
        if ((roomInfo.novice ?? 0) >= nowTimestamp) {
            roomInfo.status = RoomStatus.Novice;
        }
        // 存在重生区并且没有结束，设置为重生区
        else if ((roomInfo.respawnArea ?? 0) >= nowTimestamp) {
            roomInfo.status = RoomStatus.Respawn;
        }
    }
};

/**
 * 获取默认保存器
 *
 * @param connectInfo 服务器连接信息
 * @param distPath 保存路径
 * @returns 执行保存，并返回保存路径的异步函数
 */
export const getDefaultSaver = async function (connectInfo: ServerConnectInfo, distPath: string = DIST_PATH): Promise<ResultSaver> {
    await ensureDir(distPath);
    let saveName: string;

    // 保存官服的名称前缀
    if ('shard' in connectInfo) {
        saveName = connectInfo.shard;
    }
    // 保存私服的名称前缀
    else {
        const hash = createHash('md5').update(connectInfo.host).digest('hex');
        saveName = `drawResult.${hash}`;
    }

    // 添加时间戳后缀
    const now = new Date();
    saveName += `_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}` +
        `_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.png`;

    const savePath = path.resolve(distPath, saveName);

    return async result => {
        await result.toFile(savePath);
        return savePath;
    };
};
