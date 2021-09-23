/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { AxiosInstance } from 'axios';
import { ServerConnectInfo } from '.';
import { ScreepsService } from './service';

const createService = function (opt: ServerConnectInfo) {
    const service = new ScreepsService(opt);
    const getSpy = jest.fn();
    const postSpy = jest.fn();
    const http = (service as any).http as AxiosInstance;
    http.get = getSpy;
    http.post = postSpy;

    return { service, http, getSpy, postSpy };
};

test('可以登录', async () => {
    const { service, http } = createService({
        host: 'testHost',
        shard: 'shard3',
        token: 'testToken'
    });

    // 正确配置了服务器 url
    expect(http.defaults.baseURL).toBe('testHost');

    await service.connect();
    expect(http.defaults.headers['X-Token']).toBe('testToken');
    expect(http.defaults.headers['X-Username']).toBe('testToken');

    const { service: privateService, http: privateHttp, postSpy } = createService({
        host: 'testPrivate',
        username: 'test',
        password: '123'
    });
    postSpy.mockResolvedValueOnce({ data: { token: 'returnedToken' } });

    await privateService.connect();
    expect(postSpy.mock.calls[0][1]).toEqual({ email: 'test', password: '123' });
    expect(privateHttp.defaults.headers['X-Token']).toBe('returnedToken');
    expect(privateHttp.defaults.headers['X-Username']).toBe('returnedToken');
});

test('可以下载地图瓦片', async () => {
    const { service, getSpy } = createService({
        host: 'testHost',
        shard: 'shard3',
        token: 'testToken'
    });

    const tile = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"></svg>'
    );

    getSpy.mockResolvedValue({ data: tile });
    const result = await service.getRoomTile('roomName');
    // 发起的请求中包含房间名
    expect(getSpy.mock.calls[0][0]).toContain('roomName');
    // 可以正常接受到瓦片
    expect(result).toBe(tile);
});

test('可以下载头像', async () => {
    const { service, getSpy } = createService({
        host: 'testHost',
        shard: 'shard3',
        token: 'testToken'
    });

    // 原始头像
    const badBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <circle cx="50" cy="50" r="52" />
    </svg>`;

    // 修复后的头像
    const goodBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <circle cx="50" cy="50" r="50" />
    </svg>`;

    getSpy.mockResolvedValue({ data: badBadge });
    const result = await service.getBadge('username');
    // 发起的请求中包含玩家名
    expect(getSpy.mock.calls[0][0]).toContain('username');
    // 可以正常接收到头像并且进行了修复
    expect(result.toString()).toBe(goodBadge);
});
