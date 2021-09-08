import { fixRoomStats } from '../utils';
import { MapStatsResp, RoomStatus, PlayerBadge } from '../type';

test('可以识别新手区', () => {
    const mapStats: MapStatsResp = {
        stats: {
            W1N1: {
                status: RoomStatus.Normal,
                novice: new Date().getTime() + 5000
            }
        },
        users: { }
    };

    fixRoomStats(mapStats);
    // 状态会被从 normal 修复成 novice
    expect(mapStats).toHaveProperty('stats.W1N1.status', RoomStatus.Novice);
});

test('可以识别重生区', () => {
    const mapStats: MapStatsResp = {
        stats: {
            W1N1: {
                status: RoomStatus.Normal,
                respawnArea: new Date().getTime() + 5000
            }
        },
        users: { }
    };

    fixRoomStats(mapStats);
    // 状态会被从 normal 修复成 respawn
    expect(mapStats).toHaveProperty('stats.W1N1.status', RoomStatus.Respawn);
});

test('可以判断新手区和重生区字段同时存在时的优先级', () => {
    const mapStats: MapStatsResp = {
        stats: {
            W1N1: {
                status: RoomStatus.Normal,
                novice: new Date().getTime() + 10000,
                respawnArea: new Date().getTime() + 5000
            }
        },
        users: { }
    };

    fixRoomStats(mapStats);
    // 两个时间同时存在，应该以更长的时间为准
    expect(mapStats).toHaveProperty('stats.W1N1.status', RoomStatus.Novice);
});

test('不会修改其他属性', () => {
    const mapStats: MapStatsResp = {
        stats: {
            // 未激活房间不会被修改
            W1N1: {
                status: RoomStatus.Inactivated,
                novice: new Date().getTime() + 10000,
                respawnArea: new Date().getTime() + 5000
            },
            // 没有对应区域到期时间的正常房间也不会被修改
            W1N2: {
                status: RoomStatus.Normal
            }
        },
        users: { }
    };

    fixRoomStats(mapStats);
    expect(mapStats).toHaveProperty('stats.W1N1.status', RoomStatus.Inactivated);
    expect(mapStats).toHaveProperty('stats.W1N2.status', RoomStatus.Normal);
});

test('不会丢弃信息', () => {
    const mapStats: MapStatsResp = {
        stats: {
            W1N1: {
                status: RoomStatus.Inactivated,
                novice: new Date().getTime() + 10000,
                respawnArea: new Date().getTime() + 5000
            },
            W1N2: {
                status: RoomStatus.Normal
            },
            W1N3: {
                status: RoomStatus.Normal,
                respawnArea: new Date().getTime() + 5000
            },
            W1N4: {
                status: RoomStatus.Normal,
                novice: new Date().getTime() + 5000
            }
        },
        users: {
            a123: {
                _id: 'a123',
                username: 'player',
                badge: { type: 1 } as unknown as PlayerBadge
            }
        }
    };

    // 创建对照组并手动模拟最终结果
    const mapStatsCompare: MapStatsResp = JSON.parse(JSON.stringify(mapStats));
    if (mapStatsCompare.stats.W1N3) mapStatsCompare.stats.W1N3.status = RoomStatus.Respawn;
    if (mapStatsCompare.stats.W1N4) mapStatsCompare.stats.W1N4.status = RoomStatus.Novice;

    fixRoomStats(mapStats);

    // 两种应该相同，既不会丢弃任何信息
    expect(mapStats).toEqual(mapStatsCompare);
});
