import sharp from "sharp";
import { ScreepsService } from "./service";
import { writeJSON, readJSON, readJson } from 'fs-extra'
import { CacheManager } from "./cache";
import { DrawWorldOptions, MapStatsResp, DrawMaterial, UserInfo, MapSize, RoomStatus } from "./type";
import { mapLimit } from 'async';
import { BADGE_RESIZE_WITH_LEVEL, PIXEL_LIMIT, ROOM_SIZE } from "./constant";
import { SingleBar, Presets } from 'cli-progress';
import { addOpacity } from "./utils";

export const drawWorld = async function (options: DrawWorldOptions) {
    const { host, token, roomTileCdn, shard, getRoomNames } = options;
    const serviceOptions = (token && roomTileCdn && shard) ? { token, roomTileCdn, shard } : undefined;

    const service = new ScreepsService(host, serviceOptions);
    const cache = new CacheManager(host);

    console.log('正在初始化地图尺寸');
    const mapSize = await service.getMapSize();
    const roomNameMatrix = await getRoomNames(mapSize);

    console.log('正在从服务器读取地图数据');
    const roomStats = await readJson('./.cache/tempRoomStats.json');
    // const roomStats = await service.getMapStats({ rooms: roomNames.flat(2), shard });
    // await writeJSON('./.cache/tempRoomStats.json', roomStats);

    console.log('正在下载地图瓦片与头像');
    const createMaterials = materialCreatorFactory(service, cache, roomStats);
    const roomMaterialMatrix = await mapLimit<string[], DrawMaterial[]>(roomNameMatrix, 1, async roomNameRow => {
        return await mapLimit<string, DrawMaterial>(roomNameRow, 5, createMaterials)
    });

    console.log('正在获取 buffer')
    const roomTiles = await mapLimit<DrawMaterial[], Buffer[]>(roomMaterialMatrix, 1, async roomMaterialRow => {
        return await mapLimit<DrawMaterial, Buffer>(roomMaterialRow, 20, drawRoom)
    });

    console.log('正在拼接地图')
    await mergeRoom(roomTiles, mapSize)

    console.log('结果已保存')
}

const materialCreatorFactory = function (service: ScreepsService, cache: CacheManager, roomStats: MapStatsResp) {
    const createRoomGetter = async function (roomName: string) {
        const roomGetter = await cache.createRoomGetter(roomName);
        if (roomGetter) return roomGetter;

        const roomTile = await service.getRoomTile(roomName);
        return cache.setRoom(roomName, roomTile);
    }

    const createBadgeGetter = async function (userInfo: UserInfo) {
        const badgeGetter = await cache.createBadgeGetter(userInfo);
        if (!!badgeGetter) return badgeGetter;

        const badgeSvg = await service.getBadge(userInfo.username);
        return cache.setBadge(userInfo, badgeSvg);
    }

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

const mergeRoom = async function (tileMatrix: Buffer[][], mapSize: MapSize) {
    const height = mapSize.height * ROOM_SIZE;
    const width = mapSize.width * ROOM_SIZE;

    const mergeRowBar = new SingleBar({ format: '正在拼接行 {bar} {percentage}% {value}/{total}' }, Presets.legacy);
    mergeRowBar.start(mapSize.height, 0)

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

    mergeRowBar.stop();

    console.log('正在拼接列');

    await sharp({
        create: { height, width, channels: 4, background: '#fff' },
        limitInputPixels: PIXEL_LIMIT
    }).composite(rowBuffers.map((row, index) => ({
        input: row,
        blend: 'atop',
        top: index * ROOM_SIZE,
        left: 0
    }))).png().toFile('./result.png');
}
