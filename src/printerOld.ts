// import sharp from "sharp";
// import { ScreepsService } from "./service";
// import { writeJSON, readJSON, ensureDir } from 'fs-extra'
// import { CacheManager } from "./cache";
// import { DrawWorldOptions, MapStatsResp, DrawMaterial, UserInfo, MapSize, RoomStatus } from "./type";
// import { map, mapLimit } from 'async';
// import { DIST_PATH, PIXEL_LIMIT, ROOM_SIZE } from "./constant";
// import { SingleBar, Presets } from 'cli-progress';
// import { fixRoomStats } from "./utils";
// import path from "path";
// import { drawRoom } from "./drawRoom";

// /**
//  * 绘制指定世界地图
//  */
// export const drawWorld = async function (options: DrawWorldOptions) {
//     const { host, token, roomTileCdn, shard, getRoomNames } = options;
//     const serviceOptions = (token && shard) ? { token, roomTileCdn, shard } : undefined;
//     const service = new ScreepsService(host, serviceOptions);
//     const cache = new CacheManager(host + (shard || ''));

//     console.log(`开始绘制 ${host} ${shard || ''} 的世界地图`);

//     // 获取世界的尺寸，并将尺寸传递给外部回调来获取二维的房间名数组
//     console.log('正在加载地图尺寸');
//     const mapSize = await service.getMapSize();
//     const roomNameMatrix = await getRoomNames(mapSize);

//     // 拿着二维房间名数组请求服务器，获取所有房间和所有者的信息
//     console.log('正在获取世界信息');
//     // const roomStats = await readJSON('./.cache/tempRoomStats.json');
//     const roomStats = await service.getMapStats({ rooms: roomNameMatrix.flat(2), shard });
//     fixRoomStats(roomStats);
//     // await writeJSON('./.cache/tempRoomStats.json', roomStats);

//     // 通过房间名数组配合上一步获取的全地图数据，开始获取素材（地图瓦片和玩家头像）
//     // 这一步的耗时是最长的（在没有缓存的情况下）
//     // 在这一步会返回素材的访问器而不是直接将其载入到内存
//     console.log('正在下载素材');
//     const createMaterial = materialCreatorFactory(service, cache, roomStats);
//     const roomMaterialMatrix = await matrixMapLimit(roomNameMatrix, 15, createMaterial, '下载进度');

//     // 将所有素材按行分别读取到内存并绘制，在将绘制完成的地图行拼接成一整张图片
//     console.log('正在绘制地图')
//     const result = await drawAllRoom(roomMaterialMatrix, mapSize, cache);

//     // 获取存放路径并保存结果
//     const getSavePath = options.savePath || getDefaultSavePath;
//     const savePath = await getSavePath(host, shard);
//     await result.toFile(savePath);

//     console.log(`绘制完成！结果已保存至 ${savePath}`);
// }

// /**
//  * 获取默认保存文件路径
//  */
// const getDefaultSavePath = async (host: string, shard?: string) => {
//     await ensureDir(DIST_PATH);
//     const now = new Date();
//     return path.resolve(DIST_PATH,
//         `${shard || ''}` +
//         `_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}` +
//         `_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.png`
//     )
// }

// /**
//  * 二维数组异步迭代器
//  * async.mapLimit 的二维数组版本
//  * 
//  * @param collectionMatrix 要进行迭代的二维数组
//  * @param limit 最大并发数量
//  * @param asyncCallback 每次迭代调用的异步回调
//  * @param tip 显示在控制台的进度条提示
//  * @returns 完成迭代后的二维结果数组
//  */
// const matrixMapLimit = async function <T, R>(
//     collectionMatrix: T[][],
//     limit: number,
//     asyncCallback: (data: T) => Promise<R>,
//     tip: string
// ) {
//     const total = collectionMatrix.reduce((total, row) => total + row.length, 0);
//     const format = `${tip} {bar} {percentage}% {value}/{total}`

//     const bar = new SingleBar({ format, fps: 1 }, Presets.legacy);
//     bar.start(total, 0);

//     try {
//         // 简单粗暴使用 mapLimit 迭代两层
//         const result = await mapLimit<T[], R[]>(collectionMatrix, 1, async collectionRow => {
//             return await mapLimit<T, R>(collectionRow, limit, async data => {
//                 const itemResult = await asyncCallback(data);
//                 bar.increment();
//                 return itemResult;
//             });
//         });
    
//         bar.stop();
//         return result;
//     }
//     catch (e) {
//         bar.stop();
//         throw e;
//     }
// }


// /**
//  * 生成房间素材获取器
//  * 
//  * @param service 服务器访问实例
//  * @param cache 缓存管理实例
//  * @param roomStats 房间数据对象
//  * @returns 一个接受房间名，返回房间绘制素材集合的异步函数
//  */
// const materialCreatorFactory = function (service: ScreepsService, cache: CacheManager, roomStats: MapStatsResp) {
//     /**
//      * 从缓存 / 服务器获取房间瓦片
//      */
//     const createRoomGetter = async function (roomName: string) {
//         const roomGetter = await cache.createRoomGetter(roomName);
//         if (roomGetter) return roomGetter;

//         const roomTile = await service.getRoomTile(roomName);
//         return cache.setRoom(roomName, roomTile);
//     }

//     /**
//      * 从缓存 / 服务器获取玩家头像
//      */
//     const createBadgeGetter = async function (userInfo: UserInfo) {
//         const badgeGetter = await cache.createBadgeGetter(userInfo);
//         if (!!badgeGetter) return badgeGetter;

//         const badgeSvg = await service.getBadge(userInfo.username);
//         return cache.setBadge(userInfo, badgeSvg);
//     }

//     /**
//      * 素材创建器
//      * 解析房间名和对应的信息，获取用于绘制的素材
//      */
//     return async function (roomName: string): Promise<DrawMaterial> {
//         const roomInfo = roomStats.stats[roomName];
//         const ownerName = roomInfo?.own?.user;
//         if (!roomInfo) throw new Error(`getMapStats 未获取到 ${roomName} 的信息`);

//         const material: DrawMaterial = {
//             roomName,
//             roomInfo,
//             getRoom: await createRoomGetter(roomName),
//             getBadge: ownerName ? await createBadgeGetter(roomStats.users[ownerName]) : undefined
//         };

//         return material;
//     }
// }


// /**
//  * 绘制并将所有房间瓦片拼接成一张地图
//  * 
//  * @param materialMatrix 所有房间 Buffer
//  * @param mapSize 地图尺寸
//  */
// const drawAllRoom = async function (materialMatrix: DrawMaterial[][], mapSize: MapSize, cache: CacheManager) {
//     const height = mapSize.height * ROOM_SIZE;
//     const width = mapSize.width * ROOM_SIZE;

//     const format = '拼接进度 {bar} {percentage}% {value}/{total}'
//     const mergeRowBar = new SingleBar({ format, fps: 1 }, Presets.legacy);
//     mergeRowBar.start(mapSize.height + 1, 0);

//     // 拼接所有行
//     const rowBuffers = await mapLimit<DrawMaterial[], string>(materialMatrix, 1, async materialRow => {
//         // 绘制该行的房间
//         const roomTileRow = await map<DrawMaterial, Buffer>(materialRow, drawRoom);
//         // 生成该行背景
//         const rowBg = sharp({ create: { height: ROOM_SIZE, width, channels: 4, background: '#fff' }, limitInputPixels: PIXEL_LIMIT });

//         // 粘贴所有房间瓦片到背景上
//         const rowSharp = rowBg.composite(roomTileRow.map((input, index) => ({
//             input,
//             blend: 'atop',
//             top: 0,
//             left: index * ROOM_SIZE
//         })));

//         // 把这一行地图缓存到本地
//         const rowSavePath = await cache.setMapRow(materialRow.map(({ roomName }) => roomName), rowSharp);
//         mergeRowBar.increment();
//         return rowSavePath;
//     });

//     // 将所有行拼接在一起
//     const result = sharp({
//         create: { height, width, channels: 4, background: '#fff' },
//         limitInputPixels: PIXEL_LIMIT
//     }).composite(rowBuffers.map((input, index) => ({
//         input,
//         blend: 'atop',
//         top: index * ROOM_SIZE,
//         left: 0
//     }))).png();

//     mergeRowBar.increment();
//     mergeRowBar.stop();
//     return result;
// }
