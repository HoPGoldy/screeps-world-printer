import { Sharp } from "sharp"
import { DEFAULT_RETRY_TIME, RETRY_INTERVAL } from "./constant"
import { MapSize, MapStatsResp, RoomStatus } from "./type"

/**
 * 将地图视作一个中心对称的四象限布局来获取其房间名
 * （即像官服那样的地图）
 * 
 * @param mapSize 地图尺寸
 * @returns 房间名二维数组
 */
export const getCentrosymmetricRoomNames = async function ({ height, width }: MapSize) {
    const helfWidth = Math.floor(width / 2);
    const xSectors = [
        ...Array.from({ length: helfWidth }).map((_, x) => `W${x}`).reverse(),
        ...Array.from({ length: helfWidth }).map((_, x) => `E${x}`),
    ];

    const helfHeight = Math.floor(height / 2);
    const ySectors = [
        ...Array.from({ length: helfHeight }).map((_, x) => `N${x}`).reverse(),
        ...Array.from({ length: helfHeight }).map((_, x) => `S${x}`),
    ];

    return ySectors.map(yRoomName => xSectors.map(xRoomName => xRoomName + yRoomName));
}

/**
 * 获取 steam 版 screeps 启动的默认服务器的房间名数组
 */
export const getDefaultServerRoomNames = async function () {
    const xSectors = Array.from({ length: 11 }).map((_, x) => `W${x}`).reverse();
    const ySectors = Array.from({ length: 11 }).map((_, x) => `N${x}`).reverse();

    return ySectors.map(yRoomName => xSectors.map(xRoomName => xRoomName + yRoomName));
}

/**
 * 错误重试包装器
 * 
 * @param {async function} asyncFunc 要包装的异步函数
 * @param {number} defaultRetryTime 默认的重试次数
 * @param {number} retryInterval 重试间隔时常
 * @returns 会自动进行错误重试的异步函数
 */
export const retryWarpper = function <T>(asyncFunc: (...args: any[]) => Promise<T>) {
    let retryTime = DEFAULT_RETRY_TIME

    const retryCallback = async function(...args: any[]): Promise<T> {
        try {
            return await asyncFunc(...args);
        }
        catch (e) {
            if (retryTime <= 0) throw e;

            // console.log(`${args} 查询失败，正在重试(${DEFAULT_RETRY_TIME - retryTime}/${DEFAULT_RETRY_TIME})`)
            retryTime -= 1
            await new Promise(reslove => setTimeout(reslove, RETRY_INTERVAL, true));
            return await retryCallback(...args);
        }
    }

    return retryCallback;
}

/**
 * 给图片添加透明度
 * 
 * @param sharp 要添加的图片
 * @param opacity 透明度 0 - 255，255 是完全不透明
 * @returns 添加透明度之后的图片
 */
export const addOpacity = function (sharp: Sharp, opacity: number = 128): Sharp {
    return sharp.composite([{
        input: Buffer.from([255, 255, 255, opacity]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in'
    }]);
}

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

        // 存在新手区并且还没有结束，设置为新手区状态
        if (roomInfo.novice && roomInfo.novice >= nowTimestamp) {
            roomStats.stats[roomName].status = RoomStatus.Novice;
        }
        // 存在重生区并且没有结束，设置为重生区
        else if (roomInfo.respawnArea && roomInfo.respawnArea >= nowTimestamp) {
            roomStats.stats[roomName].status = RoomStatus.Respawn;
        }
    }
}