import { CacheManager } from './cache';
import path from 'path';
import sharp from 'sharp';
import { promises as fsPromise } from 'fs';
import fs from 'fs-extra';
import { PlayerInfo, PlayerBadge } from './type';

const cachePath = path.resolve(__dirname, '.unit-test-cache');

/**
 * 模拟图片使用
 * 使用 buffer 生成 sharp 后再转存为 buffer
 * @param bufferGetter buffer 访问器
 */
const useBuffer = async (bufferGetter: () => Promise<Buffer>): Promise<void> => {
    const buffer = await bufferGetter();
    await sharp(buffer).png().toBuffer();
};

const getPlayerBadge = (): { playerInfo: PlayerInfo, badgeBuffer: Buffer } => {
    const playerInfo: PlayerInfo = {
        _id: '123',
        username: 'playerA',
        badge: { type: 1 } as unknown as PlayerBadge
    };

    const badgeBuffer = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 100 100" shape-rendering="geometricPrecision">
        <defs>
            <clipPath id="clip">
                <circle cx="50" cy="50" r="52" />
                <!--<rect x="0" y="0" width="100" height="100"/>-->
            </clipPath>
        </defs>
        <g transform="rotate(0 50 50)">
            <rect x="0" y="0" width="100" height="100" fill="#007713" clip-path="url(#clip)"/>
            <path d="M 50 -10 L -30 100 H 130 Z" fill="#58ce56" clip-path="url(#clip)"/>
            <path d="M 50 0 L 10 100 H 90 Z" fill="#d1ff99" clip-path="url(#clip)"/>
        </g>
    </svg>`);

    return { playerInfo, badgeBuffer };
};

// 创建临时存放文件夹
beforeEach(async () => await fs.ensureDir(cachePath));
afterEach(async () => await fs.remove(cachePath));

test('可以读写头像', async () => {
    const cache = new CacheManager('cacheA', cachePath);
    const { playerInfo, badgeBuffer } = getPlayerBadge();

    // 没有缓存时返回未定义
    const badgeGetter = await cache.createBadgeGetter(playerInfo);
    expect(badgeGetter).toBeUndefined();

    // 新建个 svg 保存进去，应当可以获取到其访问器
    const existGetter = await cache.setBadge(playerInfo, badgeBuffer);
    expect(existGetter).not.toBeUndefined();

    // 模拟一下正常使用，不能出现报错
    await expect(useBuffer(existGetter)).resolves.toBeUndefined();
});

test('可以读写地图瓦片', async () => {
    const cache = new CacheManager('cacheA', cachePath);
    const roomName = 'W1N1';

    // 没有缓存时返回未定义
    const roomGetter = await cache.createRoomGetter(roomName);
    expect(roomGetter).toBeUndefined();

    const roomTile = await sharp({
        create: { height: 150, width: 150, channels: 4, background: '#fff' }
    }).png().toBuffer();

    // 新建个 png 保存进去，应当可以获取到其访问器
    const existGetter = await cache.setRoom(roomName, roomTile);
    expect(existGetter).not.toBeUndefined();

    // 模拟一下正常使用，不能出现报错
    await expect(useBuffer(existGetter)).resolves.toBeUndefined();
});

test('可以读写地图行缓存', async () => {
    const cache = new CacheManager('cacheA', cachePath);
    const roomNames = ['W1N1', 'W1N2'];

    const roomTile = await sharp({
        create: { height: 150, width: 150, channels: 4, background: '#fff' }
    }).png();

    // 新建个 png 保存进去，应当可以获取到其访问器
    const rowCachePath = await cache.setMapRow(roomNames, roomTile);
    await expect(fsPromise.access(rowCachePath)).resolves.toBeUndefined();
});

test('两个服务器之间的同名缓存不会冲突', async () => {
    const clearCachePath = path.resolve(cachePath, './conflictContrast');

    // 使用相同缓存路径的两个缓存管理
    const cacheA = new CacheManager('cacheA', clearCachePath);
    const cacheB = new CacheManager('cacheB', clearCachePath);

    const { playerInfo, badgeBuffer } = getPlayerBadge();
    await cacheA.setBadge(playerInfo, badgeBuffer);
    await cacheB.setBadge(playerInfo, badgeBuffer);
    const fileList1 = await fsPromise.readdir(clearCachePath);
    // 缓存没有被覆盖
    expect(fileList1.length).toBe(2);

    const roomNames = ['W1N1', 'W1N2'];
    const roomTile = await sharp({
        create: { height: 150, width: 150, channels: 4, background: '#fff' }
    }).png();
    const roomTileBuffer = await roomTile.toBuffer();

    await cacheA.setRoom(roomNames[0], roomTileBuffer);
    await cacheB.setRoom(roomNames[0], roomTileBuffer);
    const fileList2 = await fsPromise.readdir(clearCachePath);
    // 缓存没有被覆盖
    expect(fileList2.length).toBe(4);

    await cacheA.setMapRow(roomNames, roomTile);
    await cacheB.setMapRow(roomNames, roomTile);
    const fileList3 = await fsPromise.readdir(clearCachePath);
    // 缓存没有被覆盖
    expect(fileList3.length).toBe(6);
});

test('用户头像变更时会进行更新', async () => {
    const clearCachePath = path.resolve(cachePath, './cacheUpdate');
    const cache = new CacheManager('cacheA', clearCachePath);
    const { playerInfo, badgeBuffer } = getPlayerBadge();

    await cache.setBadge(playerInfo, badgeBuffer);

    // 更新头像信息
    playerInfo.badge.color1 = '123';

    // 不会复用原来的缓存
    const getter = await cache.createBadgeGetter(playerInfo);
    expect(getter).toBeUndefined();

    // 重新缓存后可以看到创建了新缓存
    await cache.setBadge(playerInfo, badgeBuffer);
    const fileList = await fsPromise.readdir(clearCachePath);
    expect(fileList.length).toBe(2);
});
