import EventEmitter from 'events';
import { Sharp } from 'sharp';
import { CacheManager } from './cache';
import { ScreepsService } from './service';

/**
 * 地图尺寸
 */
export interface MapSize {
    /**
     * 地图的宽度，值为对应的房间数量
     */
    width: number
    /**
     * 地图的高度，值为对应的房间数量
     */
    height: number
}

/**
 * 地图信息查询条件
 */
export interface GetMapStatsQuery {
    /**
     * 要查询的房间名
     */
    rooms: string[]
    /**
     * 要查询的 shard 名称（仅限官服）
     */
    shard?: string
}

/**
 * 房间状态
 */
export enum RoomStatus {
    /**
     * 正常房间
     */
    Normal = 'normal',
    /**
     * 新手区
     */
    Novice = 'novice',
    /**
     * 重生区
     */
    Respawn = 'respawn',
    /**
     * 未开放区域
     */
    Inactivated = 'out of borders'
}

/**
 * 房间所有者
 */
interface RoomOwner {
    /**
     * 所有者 id（非所有者昵称！）
     */
    user: string
    /**
     * 该房间的控制器等级
     */
    level: number
}

/**
 * 房间信息
 * 由 map/stats 接口获取
 */
export interface RoomInfo {
    /**
     * 该房间的状态
     * 游戏接口返回的只有正常和未激活两种状态
     * 绘制之前会根据 novice 和 respawnArea 属性来为此字段添加是否为新手区和重生区状态
     */
    status: RoomStatus
    /**
     * 该房间所有者
     */
    own?: RoomOwner
    /**
     * 当前新手区到期时间的 13 位时间戳
     */
    novice?: number
    /**
     * 当前重生区到期时间的 13 位时间戳
     */
    respawnArea?: number
    /**
     * 该房间的玩家签名
     */
    sign?: SignInfo
}

/**
 * 玩家对房间的签名
 */
interface SignInfo {
    /**
     * 签名时的时间
     */
    datetime: number
    /**
     * 签名内容
     */
    text: string
    /**
     * 签名时的游戏 tick 时间
     */
    time: number
    /**
     * 签名玩家的 id
     */
    user: string
}

/**
 * 用户头像信息
 */
export interface PlayerBadge {
    type: number
    color1: string
    color2: string
    color3: string
    param: number
    flip: boolean
}

/**
 * 用户信息
 * 由 map/stats 接口获取
 */
export interface PlayerInfo {
    _id: string
    username: string
    badge: PlayerBadge
}

/**
 * 接口 map/stats 的响应
 */
export interface MapStatsResp {
    /**
     * 所有查询的房间信息
     */
    stats: {
        [roomName: string]: RoomInfo | undefined
    }
    /**
     * 所有查询的房间所有者信息
     */
    users: {
        [userId: string]: PlayerInfo
    }
}

/**
 * 世界地图绘制配置项
 */
export interface DrawWorldOptions {
    /**
     * 要绘制的游戏服务器 ip 及端口
     */
    host: string
    /**
     * 可以登陆该服务器的玩家 token
     */
    token?: string
    /**
     * 登陆官服时需要指定绘制的 shard 名称
     */
    shard?: string
    /**
     * 可用的房间瓦片 cdn 地址
     */
    roomTileCdn?: string
    /**
     * 异步方法：获取大地图的房间信息
     *
     * 由于每个服务器的房间配置都不一样，因此提供这个函数来获取服务器的具体房间配置项，返回一个二维的房间名数组（第一维代表纵坐标，第二维代表横坐标）：
     * [
     *     ['W1N1', 'W2N1', 'W3N1'],
     *     ['W1N2', 'W2N2', 'W3N2'],
     * ]
     */
    getRoomNames: RoomNameGetter
    /**
     * 保存到的路径
     * 如：./.dist/result.png
     * 需要自行确保该路径存在
     *
     * @param host 上面传入的服务器地址
     * @param shard 上面传入的镜面名称
     */
    savePath?: (host: string, shard?: string) => Promise<string>
}

/**
 * 房间绘制素材
 */
export interface DrawMaterial {
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
}

/**
 * 官服连接配置项
 */
export type OfficalTokenConnectInfo = OfficalConnectInfoBase & {
    /**
     * 可以连接到官服的 token
     */
    token: string
};

export type OfficalPasswordConnectInfo = OfficalConnectInfoBase & {
    /**
     * 登陆官服的用户名
     */
    username: string
    /**
     * 登陆官服的密码
     */
    password: string
};

interface OfficalConnectInfoBase {
    /**
     * 官服网址，包含协议及域名
     */
    host: string
    /**
     * 要查询的 shard 名称
     */
    shard: string
    /**
     * 可选的房间瓦片 cdn 链接
     */
    roomTileCdn?: string
}

export type RoomNameGetter = (size: MapSize) => Promise<string[][]> | string[][];

export type RoomDrawer = (material: DrawMaterial) => Promise<Buffer> | Buffer;

export type ResultSaver = (result: Sharp) => Promise<string> | string;

export interface DrawContext {
    getRoomNames: RoomNameGetter
    drawRoom: RoomDrawer
    saveResult: ResultSaver
    service: ScreepsService
    cache: CacheManager
    emitter: EventEmitter
}

export interface WorldDataSet {
    roomMaterialMatrix: DrawMaterial[][]
    mapSize: MapSize
    roomStats: MapStatsResp
}

export interface PrivateConnectInfo {
    /**
     * 私服网址，包含协议、ip 及端口号
     */
    host: string
    /**
     * 登陆私服的用户名
     */
    username: string
    /**
     * 登陆私服的密码
     */
    password: string
}

export type ServerConnectInfo = OfficalTokenConnectInfo | OfficalPasswordConnectInfo | PrivateConnectInfo;

export enum PrintEvent {
    Download = 'download',
    Draw = 'draw'
}

export enum ProcessEvent {
    BeforeFetchSize = 'beforeFetchSize',
    AfterFetchSize = 'afterFetchSize',
    BeforeFetchWorld = 'beforeFetchWorld',
    AfterFetchWorld = 'afterFetchWorld',
    BeforeDownload = 'beforeDownload',
    AfterDownload = 'afterDownload',
    BeforeDraw = 'beforeDraw',
    AfterDraw = 'afterDraw',
    BeforeSave = 'beforeSave',
    AfterSave = 'afterSave'
}

export interface ProcessParam {
    [ProcessEvent.BeforeFetchSize]: {
        host: string
        shard?: string
    }
    [ProcessEvent.AfterFetchSize]: {

    }
    [ProcessEvent.BeforeFetchWorld]: {
        mapSize: MapSize
    }
    [ProcessEvent.AfterFetchWorld]: {

    }
    [ProcessEvent.BeforeDownload]: {
        roomStats: MapStatsResp
    }
    [ProcessEvent.AfterDownload]: {

    }
    [ProcessEvent.BeforeDraw]: {
        dataSet: WorldDataSet
    }
    [ProcessEvent.AfterDraw]: {

    }
    [ProcessEvent.BeforeSave]: {
        result: Sharp
    }
    [ProcessEvent.AfterSave]: {
        savePath: string
    }
}

export interface OnProcessParam<EventType extends ProcessEvent = ProcessEvent> {
    event: EventType
    data: ProcessParam[EventType]
}

export type ProcessCallbacks = {
    [eventType in ProcessEvent]?: (event: ProcessParam[eventType]) => unknown;
};
