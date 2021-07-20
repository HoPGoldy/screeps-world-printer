import { ROOM_PRE_SECTOR } from "./constant"
import { ShardSize } from "./type"

/**
 * 获取整个世界边长对应的区块数量
 * @param shardSize 
 * @returns 
 */
export const getSectorNum = function (shardSize: ShardSize) {
    return Math.floor((shardSize.width + 9 * 2) / ROOM_PRE_SECTOR)
}

/**
 * 获取单个象限边长对应的房间数量
 * 该方法将 screeps 世界视作一个正方形（虽然官方并没有确切的这么说），并使用世界的**宽度**计算其边长对应的房间数量
 * 
 * @param shardSize 
 * @returns 返回单个象限边长对应的房间数量
 */
export const getQuadrantSize = function (shardSize: ShardSize) {
    return Math.floor((shardSize.width + 9 * 2) / 2)
}

/**
 * 获取区块内的房间名
 * 将会获取该世界的区块名称（区块右下角的房间名），可以用该名称来下载区块地图
 */
export const getSectorsName = function(shardSize: ShardSize) {
    const xName = []
    
}
