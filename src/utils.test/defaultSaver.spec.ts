import path from 'path';
import sharp from 'sharp';
import { getDefaultSaver } from '../utils';
import { promises as fsPromise } from 'fs';
import fs from 'fs-extra';

const distPath = path.resolve(__dirname, '.unit-test-saver');

// 创建临时存放文件夹
beforeEach(async () => await fs.ensureDir(distPath));
afterEach(async () => await fs.remove(distPath));

test('可以保存文件', async () => {
    const officalSaver = await getDefaultSaver({ host: '', shard: 'shard3', token: '' }, distPath);
    const privateSaver = await getDefaultSaver({ host: '', username: '', password: '' }, distPath);

    const testFile = sharp({
        create: { height: 10, width: 10, channels: 3, background: '#fff' }
    }).png();

    const officalSavePath = await officalSaver(testFile);
    const privateSavePath = await privateSaver(testFile);

    await expect(fsPromise.access(officalSavePath)).resolves.toBeUndefined();
    await expect(fsPromise.access(privateSavePath)).resolves.toBeUndefined();
});
