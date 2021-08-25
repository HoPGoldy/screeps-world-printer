import sharp from "sharp";
import { ScreepsService } from "./service";
import { writeJSON, readJSON, readJson } from 'fs-extra'
import { CacheManager } from "./cache";
import { DrawWorldOptions, MapStatsResp, DrawMaterial, UserInfo, MapSize, RoomStatus } from "./type";
import { mapLimit } from 'async';
import { BADGE_RESIZE_WITH_LEVEL, PIXEL_LIMIT, ROOM_SIZE } from "./constant";
import { SingleBar, Presets } from 'cli-progress';
import { addOpacity } from "./utils";

/**
 * 绘制指定世界地图
 */
export const drawWorld = async function (options: DrawWorldOptions) {
    const { host, token, roomTileCdn, shard, getRoomNames } = options;
    const serviceOptions = (token && shard) ? { token, roomTileCdn, shard } : undefined;
    const service = new ScreepsService(host, serviceOptions);
    const cache = new CacheManager(host + (shard || ''));

    // 获取世界的尺寸，并将尺寸传递给外部回调来获取二维的房间名数组
    console.log('正在加载尺寸');
    const mapSize = await service.getMapSize();
    const roomNameMatrix = await getRoomNames(mapSize);

    // 拿着二维房间名数组请求服务器，获取所有房间和所有者的信息
    console.log('正在读取地图');
    // const roomStats = await readJson('./.cache/tempRoomStats.json');
    const roomStats = await service.getMapStats({ rooms: roomNameMatrix.flat(2), shard });
    await writeJSON('./.cache/tempRoomStats.json', roomStats);

    // 通过房间名数组配合上一步获取的全地图数据，开始获取素材（地图瓦片和玩家头像）
    // 这一步的耗时是最长的（在没有缓存的情况下）
    // 在这一步会返回素材的访问器而不是直接将其载入到内存
    const createMaterial = materialCreatorFactory(service, cache, roomStats);
    const roomMaterialMatrix = await matrixMapLimit(roomNameMatrix, 15, createMaterial, '正在下载素材');

    // 素材下载完毕，提高并发数量，将素材加载到内存并绘制单个房间的最终图像
    const roomTileMatrix = await matrixMapLimit(roomMaterialMatrix, 30, drawRoom, '正在绘制房间');

    // 将绘制完成的房间图像二维数组拼接成一整张图片
    const result = await mergeRoom(roomTileMatrix, mapSize);
    result.toFile('./result.png')

    console.log('结果已保存');
}

/**
 * 二维数组异步迭代器
 * 
 * @param collectionMatrix 要进行迭代的二维数组
 * @param limit 最大并发数量
 * @param asyncCallback 每次迭代调用的异步回调
 * @param tip 显示在控制台的进度条提示
 * @returns 完成迭代后的二维结果数组
 */
const matrixMapLimit = async function <T, R>(
    collectionMatrix: T[][],
    limit: number,
    asyncCallback: (data: T) => Promise<R>,
    tip: string
) {
    const total = collectionMatrix.reduce((total, row) => total + row.length, 0);
    const format = `${tip} {bar} {percentage}% {value}/{total}`

    const bar = new SingleBar({ format, fps: 1 }, Presets.legacy);
    bar.start(total, 0);

    try {
        const result = await mapLimit<T[], R[]>(collectionMatrix, 1, async collectionRow => {
            return await mapLimit<T, R>(collectionRow, limit, async data => {
                const itemResult = await asyncCallback(data);
                bar.increment();
                return itemResult;
            });
        });
    
        bar.stop();
        return result;
    }
    catch (e) {
        bar.stop();
        throw e;
    }
}


/**
 * 生成房间素材获取器
 * 
 * @param service 服务器访问实例
 * @param cache 缓存管理实例
 * @param roomStats 房间数据对象
 * @returns 一个接受房间名，返回房间绘制素材集合的异步函数
 */
const materialCreatorFactory = function (service: ScreepsService, cache: CacheManager, roomStats: MapStatsResp) {
    /**
     * 从缓存 / 服务器获取房间瓦片
     */
    const createRoomGetter = async function (roomName: string) {
        const roomGetter = await cache.createRoomGetter(roomName);
        if (roomGetter) return roomGetter;

        const roomTile = await service.getRoomTile(roomName);
        return cache.setRoom(roomName, roomTile);
    }

    /**
     * 从缓存 / 服务器获取玩家头像
     */
    const createBadgeGetter = async function (userInfo: UserInfo) {
        const badgeGetter = await cache.createBadgeGetter(userInfo);
        if (!!badgeGetter) return badgeGetter;

        const badgeSvg = await service.getBadge(userInfo.username);
        return cache.setBadge(userInfo, badgeSvg);
    }

    /**
     * 素材创建器
     * 解析房间名和对应的信息，获取用于绘制的素材
     */
    return async function (roomName: string): Promise<DrawMaterial> {
        const roomInfo = roomStats.stats[roomName];
        const ownerName = roomInfo?.own?.user;
        if (!roomInfo) throw new Error(`getMapStats 未获取到 ${roomName} 的信息`);

        const material: DrawMaterial = {
            roomName,
            roomInfo,
            getRoom: await createRoomGetter(roomName),
            getBadge: ownerName ? await createBadgeGetter(roomStats.users[ownerName]) : undefined
        };

        return material;
    }
}


/**
 * 绘制单个房间
 * 
 * @param material 房间绘制素材
 * @returns 单个房间的最终图像 Buffer
 */
export const drawRoom = async function (material: DrawMaterial): Promise<Buffer> {
    const roomTile = await material.getRoom();
    if (!material.getBadge) return roomTile;

    const rawBadge = await material.getBadge();
    const badgeSharp = sharp(rawBadge);
    const { width: rawBadgeWidth } = await badgeSharp.metadata();
    const ownLevel = material.roomInfo.own?.level;
    // level 有可能为 0，所以需要特判一下
    if (!rawBadgeWidth || ownLevel == undefined) throw new Error(`房间 ${material.roomName} 的头像宽度 ${rawBadgeWidth} 或玩家等级 ${ownLevel} 为空`);

    const resizeWidth = Math.ceil(rawBadgeWidth * BADGE_RESIZE_WITH_LEVEL[ownLevel]);
    let badge = badgeSharp.resize(resizeWidth);
    if (ownLevel === 0) badge = addOpacity(badgeSharp, 128);

    return sharp(roomTile).composite([{ input: await badge.toBuffer(), blend: 'atop' }]).toBuffer();
}


/**
 * 将所有房间瓦片拼接成一张地图
 * 
 * @param tileMatrix 所有房间 Buffer
 * @param mapSize 地图尺寸
 */
const mergeRoom = async function (tileMatrix: Buffer[][], mapSize: MapSize) {
    const height = mapSize.height * ROOM_SIZE;
    const width = mapSize.width * ROOM_SIZE;

    const format = '正在拼接地图 {bar} {percentage}% {value}/{total}'
    const mergeRowBar = new SingleBar({ format, fps: 1 }, Presets.legacy);
    mergeRowBar.start(mapSize.height + 1, 0);

    // 拼接所有行
    const rowBuffers = await mapLimit<Buffer[], Buffer>(tileMatrix, 10, async tileRow => {
        const rowBg = sharp({ create: { height: ROOM_SIZE, width, channels: 4, background: '#fff' }, limitInputPixels: PIXEL_LIMIT });
        const buffer = await rowBg.composite(tileRow.map((tile, index) => ({
            input: tile,
            blend: 'atop',
            top: 0,
            left: index * ROOM_SIZE
        }))).png().toBuffer();

        mergeRowBar.increment();
        return buffer;
    });

    // 将所有行拼接在一起
    const result = sharp({
        create: { height, width, channels: 4, background: '#fff' },
        limitInputPixels: PIXEL_LIMIT
    }).composite(rowBuffers.map((row, index) => ({
        input: row,
        blend: 'atop',
        top: index * ROOM_SIZE,
        left: 0
    }))).png();

    mergeRowBar.increment();
    mergeRowBar.stop();
    return result;
}
