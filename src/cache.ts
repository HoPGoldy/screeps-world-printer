import { UserInfo } from "./type";
import { promises as fsPromise } from 'fs';
import fs from 'fs-extra';
import { CACHE_PATH } from "./constant";
import { createHash } from 'crypto';
import { resolve } from 'path';
import sharp from 'sharp';

export class CacheManager {
    public readonly host: string;

    constructor(host: string) {
        this.host = host;
        // 确保缓存文件夹存在
        fs.ensureDirSync(CACHE_PATH);
    }

    async createRoomGetter(roomName: string): Promise<(() => Promise<Buffer>) | undefined> {
        const filePath = this.getRoomCachePath(roomName);
        const exists = await fs.pathExists(filePath);

        if (!exists) return undefined;

        return async () => fsPromise.readFile(filePath);
    }

    async createBadgeGetter(userInfo: UserInfo): Promise<(() => Promise<Buffer>) | undefined> {
        const filePath = this.getBadgeCachePath(userInfo);
        const exists = await fs.pathExists(filePath);

        if (!exists) return undefined;

        return async () => fsPromise.readFile(filePath);
    }

    async setRoom(roomName: string, roomTile: Buffer) {
        const filePath = this.getRoomCachePath(roomName);
        await sharp(roomTile).toFile(filePath);

        return async () => fsPromise.readFile(filePath);
    }

    async setBadge(userInfo: UserInfo, badgeSvg: Buffer) {
        const filePath = this.getBadgeCachePath(userInfo);
        await sharp(badgeSvg).toFile(filePath);

        return async () => fsPromise.readFile(filePath);
    }

    private getRoomCachePath(roomName: string): string {
        const hash = this.getHash(roomName)
        return resolve(CACHE_PATH, `./${roomName}.${hash}.png`)
    }

    private getBadgeCachePath(userInfo: UserInfo): string {
        const hash = this.getHash(userInfo.username + JSON.stringify(userInfo.badge))
        return resolve(CACHE_PATH, `./${userInfo.username}.${hash}.svg`)
    }

    private getHash(dataStr: string): string {
        return createHash('md5').update(dataStr + this.host).digest('hex')
    }
}