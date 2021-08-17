import axios from "axios";
import { createWriteStream } from "fs";
import { resolve } from "path";
import sharp from 'sharp';
import { OFFICE_MAP_CDN } from "./constant";
import { GetMapStatsQuery, MapStatsResp, ShardSize } from "./type";

const screepsService = axios.create({
    baseURL: 'https://screeps.com/'
});

export const setToken = function (token?: string) {
    if (!token) delete screepsService.defaults.headers['X-Token']
    screepsService.defaults.headers['X-Token'] = token
}

export const getShardInfo = async function (shardName: string): Promise<ShardSize> {
    const resp = await screepsService.get(`api/game/world-size?shard=${shardName}`)
    return resp.data
}

export const getMapStats = async function (data: GetMapStatsQuery): Promise<MapStatsResp> {
    const resp = await screepsService.post('api/game/map-stats', { ...data, statName: 'owner0' })
    return resp.data
}

export const getBadge = async function (username: string) {
    try {
        const resp = await screepsService.get<string>(`api/user/badge-svg?username=${username}`)
        const fixedSvg = resp.data.replace('<circle cx="50" cy="50" r="52" />', '<circle cx="50" cy="50" r="50" />')
        return Buffer.from(fixedSvg)
    }
    catch (e) {
        console.log(e.toJSON())
    }
}

export const getOfficeRoomTile = async function (shardName: string, roomName: string) {
    const resp = await axios.get(`${OFFICE_MAP_CDN}/map/${shardName}/${roomName}.png`, {
        responseType: 'arraybuffer',
    })

    // const path = resolve(__dirname, `../${shardName}${roomName}.png`)
    // const writer = createWriteStream(path)
    // resp.data.pipe(writer)
    // console.log('🚀 ~ file: service.ts ~ line 31 ~ getRoomBackground ~ resp', resp.data)
    return sharp(resp.data);
}