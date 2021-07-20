import axios from "axios";
import { createWriteStream } from "fs";
import { resolve } from "path";
import sharp from 'sharp';
import { GetMapStatsQuery, MapStatsResp, ShardSize } from "./type";

const screepsService = axios.create({
    baseURL: 'https://screeps.com/api/'
});

export const setToken = function (token?: string) {
    if (!token) delete screepsService.defaults.headers['X-Token']
    screepsService.defaults.headers['X-Token'] = token
}

export const getShardInfo = async function (shardName: string): Promise<ShardSize> {
    const resp = await screepsService.get(`game/world-size?shard=${shardName}`)
    return resp.data
}

export const getMapStats = async function (data: GetMapStatsQuery): Promise<MapStatsResp> {
    const resp = await screepsService.post('game/map-stats', { ...data, statName: 'owner0' })
    return resp.data
}

export const getBadge = async function (username: string) {
    const resp = await screepsService.get(`user/badge-svg?username=${username}`)
    return sharp(Buffer.from(resp.data));
}

export const getRoomBackground = async function (shardName: string, roomName: string) {
    const resp = await axios.get(`https://d3os7yery2usni.cloudfront.net/map/${shardName}/${roomName}.png`,{
        responseType: 'stream'
    })

    const path = resolve(__dirname, `../${shardName}${roomName}.png`)
    const writer = createWriteStream(path)
    resp.data.pipe(writer)
    // console.log('🚀 ~ file: service.ts ~ line 31 ~ getRoomBackground ~ resp', resp.data)
    return sharp(path);
}