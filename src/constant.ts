import { resolve } from 'path';
import { RoomStatus } from './type';

/** 头像边框的颜色 */
export const AVATAR_OUTLINE_COLOR = '#151515';

/**
 * 房间等级对应的头像缩放等级
 * 不缩放时几乎和地图瓦片等大
 */
export const BADGE_RESIZE_WITH_LEVEL: { [level: number]: number } = {
    8: 0.6,
    7: 0.55,
    6: 0.5,
    5: 0.45,
    4: 0.4,
    3: 0.35,
    2: 0.3,
    1: 0.25,
    0: 0.25
};

/** 默认的官服地图瓦片 cdn */
export const DEFAULT_ROOM_TILE_CDN = 'https://d3os7yery2usni.cloudfront.net';

/** 地图指定区域的颜色 */
export const ROOM_MASK_COLORS = {
    /** 未激活区域 */
    [RoomStatus.Inactivated]: '#000000',
    /** 重生区 */
    [RoomStatus.Respawn]: '#006bff',
    /** 新手保护区 */
    [RoomStatus.Novice]: '#7cff7c'
};

/** 缓存存放路径 */
export const CACHE_PATH = resolve(__dirname, '../.screeps-world-printer/cache/');

/** 结果文件存放路径 */
export const DIST_PATH = resolve(__dirname, '../.screeps-world-printer/dist/');

/** 请求出错时的重试次数 */
export const DEFAULT_RETRY_TIME = 5;

/** 请求出错时的重试间隔 */
export const RETRY_INTERVAL = 3000;

/** 请求超时时间（ms） */
export const DEFAULT_TIMEOUT = 30 * 1000;

/** 默认的房间正方形图片边长（px） */
export const ROOM_SIZE = 150;

/** sharp 像素处理上限 */
export const PIXEL_LIMIT = 800000000;
