import { drawRoom } from "../src/drawRoom";
import { DrawMaterial, RoomStatus } from "../src/type";
import { promises as fsPromise } from 'fs';
import sharp from "sharp";
import fs from 'fs-extra';
import { CACHE_PATH, DIST_PATH } from "../src/constant";
import { getArgs } from "./utils";
import path from "path";

const { tile, badge } = getArgs();

if (!tile) throw new Error('无效的地图瓦片，请使用 --tile=tile-name 指定缓存中的地图瓦片');
if (!badge) throw new Error('无效的头像 svg，请使用 --badge=badge-name 指定缓存中的头像图片');

/** 房间瓦片 png 图片路径 */
const TILE_PATH = path.resolve(CACHE_PATH, tile);
/** 头像 svg 图片路径 */
const BADGE_PATH = path.resolve(CACHE_PATH, badge);

interface TileInfo {
    name: string
    status: RoomStatus,
    level?: number
}

/** 所有的瓦片类型 */
const allTileType: TileInfo[] = [
    { name: 'level8', status: RoomStatus.Normal, level: 8 },
    { name: 'level7', status: RoomStatus.Normal, level: 7 },
    { name: 'level6', status: RoomStatus.Normal, level: 6 },
    { name: 'level5', status: RoomStatus.Normal, level: 5 },
    { name: 'level4', status: RoomStatus.Normal, level: 4 },
    { name: 'level3', status: RoomStatus.Normal, level: 3 },
    { name: 'level2', status: RoomStatus.Normal, level: 2 },
    { name: 'level1', status: RoomStatus.Normal, level: 1 },
    { name: 'level0', status: RoomStatus.Normal, level: 0 },
    { name: 'inactivated', status: RoomStatus.Inactivated },
    { name: 'novice', status: RoomStatus.Novice },
    { name: 'respawn', status: RoomStatus.Respawn },
]

const materialCreator = function (info: TileInfo): DrawMaterial {
    const material: DrawMaterial = {
        roomName: '',
        roomInfo: { status: info.status },
        getRoom: () => fsPromise.readFile(TILE_PATH)
    }

    if (info.level !== undefined) {
        material.roomInfo.own = { user: '', level: info.level };
        material.getBadge = () => fsPromise.readFile(BADGE_PATH)
    }

    return material;
}

fs.ensureDirSync(DIST_PATH);

const run = async function () {
    await Promise.all(allTileType.map(info => {
        return drawRoom(materialCreator(info)).then(result => {
            return sharp(result).toFile(`${DIST_PATH}/${info.name}.png`)
        })
    }))

    console.log('绘制结束');
}

run();