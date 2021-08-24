import axios, { AxiosInstance } from "axios";
import { DEFAULT_TIMEOUT } from "./constant";
import { GetMapStatsQuery, MapStatsResp, MapSize } from "./type";
import { retryWarpper } from "./utils";

interface OfficeServerOptions {
    token: string
    shard: string
    roomTileCdn: string
}

export class ScreepsService {
    public readonly host: string
    private http: AxiosInstance
    private roomTileCdn: string | undefined
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
            this.http.defaults.headers['X-Token'] = opt.token
            this.roomTileCdn = opt.roomTileCdn
            this.shard = opt.shard
        }
    }

    async getMapSize(): Promise<MapSize> {
        const resp = await this.http.get(`api/game/world-size?shard=${this.shard}`)
        return resp.data
    }

    async getMapStats(data: GetMapStatsQuery): Promise<MapStatsResp> {
        const resp = await this.http.post('api/game/map-stats', { ...data, statName: 'owner0' })
        return resp.data
    }

    async getBadge(username: string): Promise<Buffer> {
        const fetch = retryWarpper<Buffer>(async (username: string) => {
            const resp = await this.http.get<string>(`api/user/badge-svg?username=${username}`)
            const fixedSvg = resp.data.replace('<circle cx="50" cy="50" r="52" />', '<circle cx="50" cy="50" r="50" />')
            return Buffer.from(fixedSvg)
        })
        
        return fetch(username)
    }

    async getRoomTile(roomName: string): Promise<Buffer> {
        const fetch = retryWarpper(async (roomName: string) => {
            const base = this.roomTileCdn || this.http.defaults.baseURL
            console.log('开始获取瓦片', roomName)
            return await axios.get(`${base}/map/${this.shard}/${roomName}.png`, {
                responseType: 'arraybuffer'
            })
        })

        const resp = await fetch(roomName)
        return resp.data
    }
}