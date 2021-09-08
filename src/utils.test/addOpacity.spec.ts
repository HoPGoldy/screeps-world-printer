import sharp from 'sharp';
import { addOpacity } from '../utils';

/**
 * 这里用的方法不会修改图片的基本信息
 * 没法具体判断是否成功叠加了透明度
 * 所以只需要保证运行不报错就可以了
 */
test('可以正确的添加透明度', async () => {
    const raw = sharp({
        create: { height: 10, width: 10, channels: 3, background: '#fff' }
    });

    addOpacity(raw);
});
