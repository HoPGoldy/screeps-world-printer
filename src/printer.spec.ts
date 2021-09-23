/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { MapStatsResp, PlayerBadge, RoomStatus } from './type';
import { ScreepsWorldPrinter } from './printer';
import { ScreepsService } from './service';

// 默认的 mock 地图信息
const DEFAULT_MAP_STATS: MapStatsResp = {
    stats: {
        E0N0: { status: RoomStatus.Normal, own: { user: 'asd123', level: 2 } },
        W0N0: { status: RoomStatus.Inactivated },
        W0S0: { status: RoomStatus.Novice },
        E0S0: { status: RoomStatus.Respawn }
    },
    users: {
        asd123: { _id: 'asd123', username: 'testUser', badge: {} as PlayerBadge }
    }
};

const getSvgBuffer = async (): Promise<Buffer> => Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"></svg>'
);

const mockService = (service: ScreepsService) => {
    const connect = jest.fn();
    const getBadge = jest.fn(getSvgBuffer);
    const getRoomTile = jest.fn(getSvgBuffer);
    const getMapSize = jest.fn(async () => ({ width: 2, height: 2 }));
    const getMapStats = jest.fn(async () => JSON.parse(JSON.stringify(DEFAULT_MAP_STATS)));
    service.connect = connect;
    service.getBadge = getBadge;
    service.getMapSize = getMapSize;
    service.getMapStats = getMapStats;
    service.getRoomTile = getRoomTile;

    return { connect, getBadge, getMapStats, getMapSize, getRoomTile };
};

test('可以正常下载内容', async () => {
    const printer = new ScreepsWorldPrinter({
        host: 'testHost',
        shard: 'shard3',
        token: 'testToken'
    });

    mockService(printer.service);
    printer.silence();

    const worldDataSet = await printer.fetchWorld();
    expect(worldDataSet).toHaveProperty('roomMaterialMatrix');
    expect(worldDataSet).toHaveProperty('mapSize');
    expect(worldDataSet).toHaveProperty('roomStats');
});

test('可以设置房间名解析器', async () => {
    const printer = new ScreepsWorldPrinter({
        host: 'testHost',
        shard: 'shard3',
        token: 'testToken'
    }, async () => [['W0N0']]);

    mockService(printer.service);
    printer.silence();

    const worldDataSet = await printer.fetchWorld();
    expect(worldDataSet.roomMaterialMatrix.length).toBe(1);
    expect(worldDataSet.roomMaterialMatrix[0].length).toBe(1);

    printer.setRoomNameGetter(async () => [[undefined, 'W0N0', 'W0S0']]);
    const newWorldDataSet = await printer.fetchWorld();
    expect(newWorldDataSet.roomMaterialMatrix.length).toBe(1);
    expect(newWorldDataSet.roomMaterialMatrix[0].length).toBe(3);
    // 因为新设置的房间名第一个是个 undefined，所以这里也会返回 undefined
    expect(newWorldDataSet.roomMaterialMatrix[0][0]).toBeUndefined();
});

test('可以正常执行绘制', async () => {
    const printer = new ScreepsWorldPrinter({
        host: 'testHost',
        shard: 'shard3',
        token: 'testToken'
    });

    mockService(printer.service);

    const saver = jest.fn(async () => 'save path');
    printer.setResultSaver(saver);

    await printer.drawWorld();

    expect(saver).toBeCalledTimes(1);
});
