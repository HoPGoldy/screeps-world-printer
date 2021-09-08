import { PlayerInfo } from './type';
import { promises as fsPromise } from 'fs';
import fs from 'fs-extra';
import { CACHE_PATH } from './constant';
import { createHash } from 'crypto';
import { resolve } from 'path';
import sharp, { Sharp } from 'sharp';

/**
 * 缓存管理器
 * 用于统一访问本地的缓存图片
 */
export class CacheManager {
    public readonly mapKey: string;
    public readonly cachePath: string;

    /**
     * 实例化缓存管理器
     * 由于不同地图的缓存会存放在一起，所以需要一个识别字符用于确定要访问那个地图的缓存
     * 例如 服务器访问地址 + shard 名称
     *
     * @param mapKey 服务器识别信息
     */
    constructor (mapKey: string, cachePath = CACHE_PATH) {
        this.mapKey = mapKey;
        // 确保缓存文件夹存在
        fs.ensureDirSync(cachePath);
        this.cachePath = cachePath;
    }

    /**
     * 创建房间瓦片获取器
     * 当不存在对应缓存的时候返回 undefined
     *
     * @param roomName 要查询的房间名
     * @returns 获取房间瓦片 Buffer 的异步函数
     */
    async createRoomGetter (roomName: string): Promise<(() => Promise<Buffer>) | undefined> {
        const filePath = this.getRoomCachePath(roomName);
        const exists = await fs.pathExists(filePath);
        if (!exists) return undefined;

        return async () => await fsPromise.readFile(filePath);
    }

    /**
     * 创建玩家头像获取器
     * 当不存在对应缓存的时候返回 undefined
     *
     * @param roomName 要查询的玩家头像
     * @returns 获取玩家头像 Buffer 的异步函数
     */
    async createBadgeGetter (playerInfo: PlayerInfo): Promise<(() => Promise<Buffer>) | undefined> {
        const filePath = this.getBadgeCachePath(playerInfo);
        const exists = await fs.pathExists(filePath);
        if (!exists) return undefined;

        return async () => await fsPromise.readFile(filePath);
    }

    /**
     * 缓存指定房间瓦片
     *
     * @param roomName 房间名
     * @param roomTile 房间瓦片
     */
    async setRoom (roomName: string, roomTile: Buffer): Promise<() => Promise<Buffer>> {
        const filePath = this.getRoomCachePath(roomName);
        await sharp(roomTile).toFile(filePath);

        return async () => await fsPromise.readFile(filePath);
    }

    /**
     * 缓存指定玩家头像
     *
     * @param playerInfo 玩家信息
     * @param badgeSvg 玩家头像
     */
    async setBadge (playerInfo: PlayerInfo, badgeSvg: Buffer): Promise<() => Promise<Buffer>> {
        const filePath = this.getBadgeCachePath(playerInfo);
        await sharp(badgeSvg).toFile(filePath);

        return async () => await fsPromise.readFile(filePath);
    }

    /**
     * 通过房间名获取瓦片缓存存放路径
     */
    private getRoomCachePath (roomName: string): string {
        const hash = this.getHash(roomName);
        return resolve(this.cachePath, `./${roomName}.${hash}.png`);
    }

    /**
     * 通过玩家信息获取头像缓存存放路径
     */
    private getBadgeCachePath (playerInfo: PlayerInfo): string {
        const hash = this.getHash(playerInfo.username + JSON.stringify(playerInfo.badge));
        return resolve(this.cachePath, `./${playerInfo.username}.${hash}.svg`);
    }

    /**
     * 获取唯一签名
     * 由于有可能同时缓存多个服务器的地图瓦片和用户头像
     * 为了防止重名导致错误使用其他服务器的图片，这里会使用服务器访问地址进行唯一签名
     */
    private getHash (dataStr: string): string {
        return createHash('md5').update(dataStr + this.mapKey).digest('hex');
    }

    /**
     * 将地图行结果缓存起来
     * 由于后面就直接执行拼接了，拼接时可以接受文件路径，所以这里就不返回 buffer 访问器了
     *
     * @param roomNames 该地图行包含的房间名称
     * @param mapRowSharp 地图行 sharp 对象
     * @returns 保存到的路径
     */
    public async setMapRow (roomNames: string[], mapRowSharp: Sharp): Promise<string> {
        const mapRowHash = this.getHash(roomNames.join(','));
        const rowSavePath = resolve(this.cachePath, `./mapRow.${mapRowHash}.png`);

        await mapRowSharp.png().toFile(rowSavePath);
        return rowSavePath;
    }
}
