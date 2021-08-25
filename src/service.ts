import axios, { AxiosInstance } from "axios";
import { DEFAULT_ROOM_TILE_CDN, DEFAULT_TIMEOUT } from "./constant";
import { GetMapStatsQuery, MapStatsResp, MapSize } from "./type";
import { retryWarpper } from "./utils";

/** 官服连接配置项 */
interface OfficeServerOptions {
    /** 可以连接到官服的 token */
    token: string
    /** 要查询的 shard 名称 */
    shard: string
    /** 可选的房间瓦片 cdn 链接 */
    roomTileCdn?: string
}

export class ScreepsService {
    /**
     * 服务器的访问地址
     */
    public readonly host: string
    /**
     * 执行查询的 axios 实例
     */
    private http: AxiosInstance
    /**
     * 可选的房间瓦片 cdn 链接
     */
    private roomTileCdn: string | undefined
    /**
     * 目标是官服的话，要查询的 shard 名称
     */
    private shard: string | undefined

    /**
     * 实例化 screeps 服务端请求器
     * 
     * @param baseURL 服务器访问地址（及端口）
     * @param token 可以登陆该服务器的任意玩家 token
     * @param roomTileCdn 可选，该服务器的房间瓦片 cdn 地址
     */
    constructor(baseURL: string, opt?: OfficeServerOptions) {
        this.host = baseURL;
        this.http = axios.create({ baseURL });
        this.http.defaults.timeout = DEFAULT_TIMEOUT;
        if (opt) {
            this.http.defaults.headers['X-Token'] = opt.token;
            this.roomTileCdn = opt.roomTileCdn || DEFAULT_ROOM_TILE_CDN;
            this.shard = opt.shard;
        }
    }

    /**
     * 获取地图的尺寸
     * 目标服务器是官服的话将获取指定 shard 的尺寸
     */
    async getMapSize(): Promise<MapSize> {
        const resp = await this.http.get(`api/game/world-size?shard=${this.shard}`);
        return resp.data;
    }

    /**
     * 根据房间名查询指定房间信息
     */
    async getMapStats(data: GetMapStatsQuery): Promise<MapStatsResp> {
        const resp = await this.http.post('api/game/map-stats', { ...data, statName: 'owner0' });
        return resp.data;
    }

    /**
     * 获取指定玩家头像 Buffer
     * @param username 玩家名
     */
    async getBadge(username: string): Promise<Buffer> {
        const fetch = retryWarpper<Buffer>(async (username: string) => {
            const resp = await this.http.get<string>(`api/user/badge-svg?username=${username}`);
            // 对头像进行修复，原来的头像会有一点偏
            const fixedSvg = resp.data.replace('<circle cx="50" cy="50" r="52" />', '<circle cx="50" cy="50" r="50" />');

            // 如果下载到了空数据就报错弹出进行重试
            if (fixedSvg.length <= 0) throw new Error(`下载到了空头像 ${username}`);
            
            return Buffer.from(fixedSvg);
        })
        
        return fetch(username);
    }

    /**
     * 获取指定房间瓦片 Bufer
     * @param roomName 房间名
     */
    async getRoomTile(roomName: string): Promise<Buffer> {
        const fetch = retryWarpper(async (roomName: string) => {
            const base = this.roomTileCdn || this.http.defaults.baseURL;
            const roomTile = await axios.get<Buffer>(`${base}/map/${this.shard}/${roomName}.png`, {
                timeout: DEFAULT_TIMEOUT,
                responseType: 'arraybuffer'
            });

            // 如果下载到了空数据就报错弹出进行重试
            if (roomTile.data.length <= 0) throw new Error(`下载到了空瓦片 ${roomName}`);

            return roomTile.data;
        });

        return fetch(roomName);
    }
}