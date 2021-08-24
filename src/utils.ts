import { Sharp } from "sharp"
import { DEFAULT_RETRY_TIME, RETRY_INTERVAL } from "./constant"
import { MapSize } from "./type"

/**
 * 将地图视作一个中心对称的四象限布局来获取其房间名
 * （即像官服那样的地图）
 * 
 * @param mapSize 地图尺寸
 * @returns 房间名二维数组
 */
export const getCentrosymmetricRoomNams = async function ({ height, width }: MapSize) {
    const helfWidth = Math.floor(width / 2)
    const xSectors = [
        ...Array.from({ length: helfWidth }).map((_, x) => `W${x}`).reverse(),
        ...Array.from({ length: helfWidth }).map((_, x) => `E${x}`),
    ]

    const helfHeight = Math.floor(height / 2)
    const ySectors = [
        ...Array.from({ length: helfHeight }).map((_, x) => `N${x}`).reverse(),
        ...Array.from({ length: helfHeight }).map((_, x) => `S${x}`),
    ]

    return ySectors.map(yRoomName => xSectors.map(xRoomName => xRoomName + yRoomName))
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
            return await asyncFunc(...args)
        }
        catch (e) {
            if (retryTime <= 0) throw e

            console.log(`${args} 查询失败，正在重试(${DEFAULT_RETRY_TIME - retryTime}/${DEFAULT_RETRY_TIME})`)
            retryTime -= 1
            await new Promise(reslove => setTimeout(reslove, RETRY_INTERVAL, true))
            return await retryCallback(...args)
        }
    }

    return retryCallback
}

export const addOpacity = function (sharp: Sharp, opacity: number = 128): Sharp {
    return sharp.composite([{
        input: Buffer.from([255, 255, 255, opacity]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in'
    }]);
}

/**
 * 控制并发数量
 * 
 * @param {any[]} collection 待执行的任务数组
 * @param {number} limit 最大并发数量
 * @param {async function} asyncCallback 要执行的异步回调
 */
export const concurrent = async function <T, R>(collection: T[], limit: number, asyncCallback: (task: T, index: number) => Promise<R>): Promise<R[]> {
    // 用于在 while 循环中取出任务的迭代器
    const taskIterator = collection.entries();
    // 任务池
    const pool = new Set();
    // 最终返回的结果数组
    const finalResult: R[] = [];

    do {
        const { done, value: [index, task] = [] } = taskIterator.next();
        // 任务都已执行，等待最后的剩下的任务执行完毕
        if (done) {
            await Promise.allSettled(pool);
            break;
        };

        // 将结果存入结果数组，并从任务池中移除自己
        const promise = retryWarpper(asyncCallback)(task, index)
            .then(data => finalResult[index] = data)
            .finally(() => pool.delete(promise))

        // 达到上限后就等待某个任务完成
        if (pool.add(promise).size >= limit) {
            await Promise.race(pool);
        }
    } while (true)

    return Array.from(finalResult);
}