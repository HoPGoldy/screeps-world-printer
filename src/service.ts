import axios, { AxiosInstance } from 'axios';
import { DEFAULT_ROOM_TILE_CDN, DEFAULT_TIMEOUT } from './constant';
import { MapStatsResp, MapSize, ServerConnectInfo } from './type';
import { retryWrapper } from './utils';

export class ScreepsService {
    /**
     * 服务器的访问地址
     */
    public readonly host: string;
    /**
     * 目标是官服的话，要查询的 shard 名称
     */
    public shard: string | undefined;
    /**
     * 执行查询的 axios 实例
     */
    private readonly http: AxiosInstance;
    /**
     * 可选的房间瓦片 cdn 链接
     */
    private roomTileCdn: string | undefined;
    /**
     * 服务器连接信息
     */
    private readonly connectInfo: ServerConnectInfo;

    /**
     * 实例化 screeps 服务端请求器
     */
    constructor (opt: ServerConnectInfo) {
        this.host = opt.host;
        this.http = axios.create({ baseURL: opt.host });
        this.http.defaults.timeout = DEFAULT_TIMEOUT;
        if ('shard' in opt) this.shard = opt.shard;
        this.connectInfo = opt;
    }

    /**
     * 连接服务器
     */
    async connect (): Promise<void> {
        const opt = this.connectInfo;
        if ('token' in opt) {
            this.setToken(opt.token);
            this.roomTileCdn = opt.roomTileCdn ?? DEFAULT_ROOM_TILE_CDN;
            this.shard = opt.shard;
        }
        else if ('username' in this.connectInfo && 'password' in this.connectInfo) {
            await this.login(opt.username, opt.password);
        }
        else throw new Error('无效的连接方式');
    }

    /**
     * 进行账号验证
     *
     * @param email 登陆玩家名
     * @param password 玩家密码
     */
    private async login (email: string, password: string): Promise<void> {
        const resp = await this.http.post('api/auth/signin', { email, password });
        this.setToken(resp.data.token);
    }

    /**
     * 使用新令牌
     *
     * @param newToken 新的令牌
     */
    private setToken (newToken: string): void {
        this.http.defaults.headers['X-Token'] = newToken;
        this.http.defaults.headers['X-Username'] = newToken;
    }

    /**
     * 获取地图的尺寸
     * 目标服务器是官服的话将获取指定 shard 的尺寸
     */
    async getMapSize (): Promise<MapSize> {
        const resp = await this.http.get(`api/game/world-size?shard=${this.shard ?? ''}`);
        return resp.data;
    }

    /**
     * 根据房间名查询指定房间信息
     */
    async getMapStats (rooms: string[]): Promise<MapStatsResp> {
        const query = { rooms, shard: this.shard, statName: 'owner0' };
        const resp = await this.http.post('api/game/map-stats', query);
        return resp.data;
    }

    /**
     * 获取指定玩家头像 Buffer
     * @param username 玩家名
     */
    async getBadge (username: string): Promise<Buffer> {
        const fetch = retryWrapper<Buffer>(async (username: string) => {
            const resp = await this.http.get<string>(`api/user/badge-svg?username=${username}`);
            // 对头像进行修复，原来的头像会有一点偏
            const fixedSvg = resp.data.replace('<circle cx="50" cy="50" r="52" />', '<circle cx="50" cy="50" r="50" />');

            // 如果下载到了空数据就报错弹出进行重试
            if (fixedSvg.length <= 0) throw new Error(`下载到了空头像 ${username}`);

            return Buffer.from(fixedSvg);
        });

        return await fetch(username);
    }

    /**
     * 获取指定房间瓦片 Bufer
     * @param roomName 房间名
     */
    async getRoomTile (roomName: string): Promise<Buffer> {
        const fetch = retryWrapper(async (roomName: string) => {
            const base = this.roomTileCdn ?? this.http.defaults.baseURL ?? '';

            // 官服和私服的瓦片存放路径不一样，这里用是否有 shard 区分官服和私服
            const fullPath = this.shard
                ? `${base}/map/${this.shard}/${roomName}.png`
                : `${base}/assets/map/${roomName}.png`;

            const roomTile = await axios.get<Buffer>(fullPath, {
                timeout: DEFAULT_TIMEOUT,
                responseType: 'arraybuffer'
            });

            // 如果下载到了空数据就报错弹出进行重试
            if (roomTile.data.length <= 0) throw new Error(`下载到了空瓦片 ${roomName}`);

            return roomTile.data;
        });

        return await fetch(roomName);
    }
}
