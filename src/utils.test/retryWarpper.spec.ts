import { retryWrapper } from '../utils';
import { DEFAULT_RETRY_TIME, RETRY_INTERVAL } from '../constant';

test('可以重试指定次数及等待指定间隔', async () => {
    const spy = jest.fn(async () => await Promise.reject(new Error('故意报错')));
    const wrappedSpy = retryWrapper(spy, 2, 300);

    await expect(wrappedSpy()).rejects.toThrow('故意报错');
    // 默认执行一次 + 重试两次
    expect(spy).toBeCalledTimes(3);
}, 1000);

test('默认重试次数及间隔正确', async () => {
    const spy = jest.fn(async () => await Promise.reject(new Error('故意报错')));
    const wrappedSpy = retryWrapper(spy);

    await expect(wrappedSpy()).rejects.toThrow('故意报错');
    expect(spy).toBeCalledTimes(DEFAULT_RETRY_TIME + 1);
}, RETRY_INTERVAL * DEFAULT_RETRY_TIME + 500);

test('resolved 之后不会重试', async () => {
    const spy = jest.fn(async () => await Promise.resolve('result'));
    const wrappedSpy = retryWrapper(spy);

    const result = await wrappedSpy();
    expect(result).toBe('result');
    expect(spy).toBeCalledTimes(1);
});

test('超过重试上限前 resolved 可以正常返回', async () => {
    let retryTime = 0;
    // 将在第三次重试时返回正确答案
    const spy = jest.fn(async () => {
        retryTime += 1;
        if (retryTime <= 3) return await Promise.reject(new Error('故意报错'));
        return await Promise.resolve('result');
    });
    const wrappedSpy = retryWrapper(spy, 6, 300);

    const result = await wrappedSpy();
    // 可以正常返回结果并重试了指定次数
    expect(result).toBe('result');
    expect(spy).toBeCalledTimes(4);
});
