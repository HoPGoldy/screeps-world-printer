import sharp, { OverlayOptions } from 'sharp';
// import { writeJSON, readJSON } from 'fs-extra';
import { MapStatsResp, DrawMaterial, UserInfo, PrintEvent, ProcessEvent, WorldDataSet, DrawContext } from './type';
import { map, mapLimit } from 'async';
import { PIXEL_LIMIT, ROOM_SIZE } from './constant';
import { fixRoomStats } from './utils';

/**
 * 获取绘制世界所需的全部素材
 */
export const fetchWorld = async function (context: DrawContext): Promise<WorldDataSet> {
    const { emitter, service, getRoomNames } = context;
    const { host, shard } = service;

    await service.connect();

    // 获取世界的尺寸，并将尺寸传递给外部回调来获取二维的房间名数组
    emitter.emit(ProcessEvent.BeforeFetchSize, { host, shard });
    const mapSize = await service.getMapSize();
    const roomNameMatrix = await getRoomNames(mapSize);
    emitter.emit(ProcessEvent.AfterFetchSize, { });

    // 拿着二维房间名数组请求服务器，获取所有房间和所有者的信息
    emitter.emit(ProcessEvent.BeforeFetchWorld, { mapSize });
    // const roomStats = await readJSON('./.cache/tempRoomStats.json');
    const roomStats = await service.getMapStats(roomNameMatrix.flat(2));
    fixRoomStats(roomStats);
    // await writeJSON('./.cache/tempRoomStats.json', roomStats);
    emitter.emit(ProcessEvent.AfterFetchWorld, { });

    // 通过房间名数组配合上一步获取的全地图数据，开始获取素材（地图瓦片和玩家头像）
    // 这一步的耗时是最长的（在没有缓存的情况下）
    // 在这一步会返回素材的访问器而不是直接将其载入到内存
    emitter.emit(ProcessEvent.BeforeDownload, { roomStats });
    const createMaterial = materialCreatorFactory(context, roomStats);
    const roomMaterialMatrix = await matrixMapLimit(roomNameMatrix, 15, createMaterial);
    emitter.emit(ProcessEvent.AfterDownload, { });

    return { roomMaterialMatrix, mapSize, roomStats };
};

/**
 * 绘制指定世界地图
 */
export const drawWorld = async function (dataSet: WorldDataSet, context: DrawContext): Promise<string> {
    const { emitter, saveResult } = context;

    // 将所有素材按行分别读取到内存并绘制，再将绘制完成的地图行拼接成一整张图片
    emitter.emit(ProcessEvent.BeforeDraw, { dataSet });
    const result = await drawAllRoom(dataSet, context);
    emitter.emit(ProcessEvent.AfterDraw, { });

    // 获取存放路径并保存结果
    emitter.emit(ProcessEvent.BeforeSave, { result });
    const savePath = await saveResult(result);
    emitter.emit(ProcessEvent.AfterSave, { savePath });

    return savePath;
};

/**
 * 二维数组异步迭代器
 * async.mapLimit 的二维数组版本
 *
 * @param collectionMatrix 要进行迭代的二维数组
 * @param limit 最大并发数量
 * @param asyncCallback 每次迭代调用的异步回调
 * @returns 完成迭代后的二维结果数组
 */
const matrixMapLimit = async function <T, R>(
    collectionMatrix: T[][],
    limit: number,
    asyncCallback: (data: T) => Promise<R>
): Promise<R[][]> {
    // 简单粗暴使用 mapLimit 迭代两层
    const result = await mapLimit<T[], R[]>(collectionMatrix, 1, async collectionRow => {
        return await mapLimit<T, R>(collectionRow, limit, asyncCallback);
    });

    return result;
};

/**
 * 生成房间素材获取器
 *
 * @param context 上下文
 * @param roomStats 房间数据对象
 * @returns 一个接受房间名，返回房间绘制素材集合的异步函数
 */
const materialCreatorFactory = function (
    context: DrawContext,
    roomStats: MapStatsResp
): (roomName: string) => Promise<DrawMaterial> {
    const { cache, service, emitter } = context;
    /**
     * 从缓存 / 服务器获取房间瓦片
     */
    const createRoomGetter = async function (roomName: string): Promise<() => Promise<Buffer>> {
        const roomGetter = await cache.createRoomGetter(roomName);
        if (roomGetter) return roomGetter;

        const roomTile = await service.getRoomTile(roomName);
        return await cache.setRoom(roomName, roomTile);
    };

    /**
     * 从缓存 / 服务器获取玩家头像
     */
    const createBadgeGetter = async function (userInfo: UserInfo): Promise<() => Promise<Buffer>> {
        const badgeGetter = await cache.createBadgeGetter(userInfo);
        if (badgeGetter) return badgeGetter;

        const badgeSvg = await service.getBadge(userInfo.username);
        return await cache.setBadge(userInfo, badgeSvg);
    };

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

        emitter.emit(PrintEvent.Download, roomName, material, roomStats);
        return material;
    };
};

/**
 * 绘制并将所有房间瓦片拼接成一张地图
 *
 * @param dataSet 绘制所需数据
 * @param context 上下文
 */
const drawAllRoom = async function (dataSet: WorldDataSet, context: DrawContext): Promise<sharp.Sharp> {
    const { mapSize, roomMaterialMatrix } = dataSet;
    const { drawRoom, cache, emitter } = context;

    const height = mapSize.height * ROOM_SIZE;
    const width = mapSize.width * ROOM_SIZE;

    // 在每次绘制完成后发射绘制事件
    // 为了防止内存泄漏，这里不会把绘制结果发射出去
    const roomDrawer = async (material: DrawMaterial): Promise<Buffer> => {
        const roomResult = await drawRoom(material);
        emitter.emit(PrintEvent.Draw, material);
        return roomResult;
    };

    // 地图行绘制器
    const rowDrawer = async (materialRow: DrawMaterial[]): Promise<string> => {
        // 绘制该行的房间
        emitter.emit(PrintEvent.Draw);
        const roomTileRow = await map<DrawMaterial, Buffer>(materialRow, roomDrawer);
        // 生成该行背景
        const rowBg = sharp({
            create: { height: ROOM_SIZE, width, channels: 4, background: '#fff' },
            limitInputPixels: PIXEL_LIMIT
        });

        // 粘贴所有房间瓦片到背景上
        const rowSharp = rowBg.composite(roomTileRow.map((input, index) => ({
            input,
            blend: 'atop',
            top: 0,
            left: index * ROOM_SIZE
        })));

        // 把这一行地图缓存到本地
        const rowroomNames = materialRow.map(({ roomName }) => roomName);
        const rowSavePath = await cache.setMapRow(rowroomNames, rowSharp);
        return rowSavePath;
    };

    // 绘制所有行
    const rowBuffers = await mapLimit<DrawMaterial[], string>(roomMaterialMatrix, 1, rowDrawer);

    // 将所有行拼接在一起
    const overlays: OverlayOptions[] = rowBuffers.map((input, index) => ({
        input,
        blend: 'atop',
        top: index * ROOM_SIZE,
        left: 0
    }));

    const result = sharp({
        create: { height, width, channels: 4, background: '#fff' },
        limitInputPixels: PIXEL_LIMIT
    }).composite(overlays).png();

    return result;
};
