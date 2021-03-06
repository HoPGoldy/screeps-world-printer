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
 * 头像边框配置项
 * 默认配置见 @see https://github.com/HoPGoldy/screeps-world-printer/blob/main/src/constant.ts#L58
 */
export interface GetBadgeBorderFuncOptions {
    /**
     * 边框的粗细
     */
    strokeWidth: number
    /**
     * 边框的填充色
     */
    fill: string
}

/**
 * 获取头像边框
 */
export type GetBadgeBorderFunc = (opt?: Partial<GetBadgeBorderFuncOptions>) => Promise<Buffer>;

/**
 * 获取房间瓦片蒙版
 */
export type GetMaskFunc = (type: MaskType, size?: number) => Promise<Buffer>;

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
    /**
     * 获取头像边框
     */
    getBadgeBorder?: GetBadgeBorderFunc
    /**
     * 获取正方形图层蒙版
     * @param type 蒙版类型
     * @param size 蒙版的长宽
     */
    getMask: GetMaskFunc
}

/**
 * 蒙版类型
 */
export type MaskType = RoomStatus.Inactivated | RoomStatus.Novice | RoomStatus.Respawn;

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

export type RoomNameGetter = (size: MapSize) => Promise<Array<Array<string | undefined>>>;

export type RoomDrawer = (material: DrawMaterial | undefined) => Promise<Buffer | undefined>;

export type ResultSaver = (result: Sharp) => Promise<string>;

export interface DrawContext {
    getRoomNames: RoomNameGetter
    drawRoom: RoomDrawer
    saveResult: ResultSaver
    service: ScreepsService
    cache: CacheManager
    emitter: EventEmitter
}

export interface WorldDataSet {
    roomMaterialMatrix: Array<Array<DrawMaterial | undefined>>
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

/**
 * 服务器连接信息
 * 包括官服 token、官服账号密码、私服账号密码
 */
export type ServerConnectInfo = OfficalTokenConnectInfo | OfficalPasswordConnectInfo | PrivateConnectInfo;

/**
 * 所有绘制事件
 */
export enum PrintEvent {
    /**
     * 获取服务器地图尺寸之前
     */
    BeforeFetchSize = 'beforeFetchSize',
    /**
     * 获取服务器地图尺寸之后
     */
    AfterFetchSize = 'afterFetchSize',
    /**
     * 获取服务器房间信息之前
     */
    BeforeFetchWorld = 'beforeFetchWorld',
    /**
     * 获取服务器房间信息之后
     */
    AfterFetchWorld = 'afterFetchWorld',
    /**
     * 下载绘制素材之前
     */
    BeforeDownload = 'beforeDownload',
    /**
     * 单个房间素材下载完成
     */
    Download = 'download',
    /**
     * 所有绘制素材下载完成之后
     */
    AfterDownload = 'afterDownload',
    /**
     * 开始绘制之前
     */
    BeforeDraw = 'beforeDraw',
    /**
     * 单个房间绘制完成
     */
    Draw = 'draw',
    /**
     * 地图绘制完成之后
     */
    AfterDraw = 'afterDraw',
    /**
     * 保存之前
     */
    BeforeSave = 'beforeSave',
    /**
     * 保存之后
     */
    AfterSave = 'afterSave'
}

/**
 * 绘制事件对应的回调参数
 */
export interface ProcessParam {
    [PrintEvent.BeforeFetchSize]: {
        host: string
        shard?: string
    }
    [PrintEvent.AfterFetchSize]: {

    }
    [PrintEvent.BeforeFetchWorld]: {
        mapSize: MapSize
    }
    [PrintEvent.AfterFetchWorld]: {

    }
    [PrintEvent.BeforeDownload]: {
        roomStats: MapStatsResp
    }
    [PrintEvent.Download]: {
        material: DrawMaterial
    }
    [PrintEvent.AfterDownload]: {

    }
    [PrintEvent.BeforeDraw]: {
        dataSet: WorldDataSet
    }
    [PrintEvent.Draw]: {
        material: DrawMaterial
    }
    [PrintEvent.AfterDraw]: {

    }
    [PrintEvent.BeforeSave]: {
        result: Sharp
    }
    [PrintEvent.AfterSave]: {
        savePath: string
    }
}

/**
 * 绘制事件回调对象
 */
export type PrintEventListeners = {
    [eventType in PrintEvent]?: (event: ProcessParam[eventType]) => unknown;
};
