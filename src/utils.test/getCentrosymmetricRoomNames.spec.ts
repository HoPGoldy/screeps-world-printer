import { getCentrosymmetricRoomNames } from '../utils';

test('可以生成四象限房间名', async () => {
    const roomNames1 = await getCentrosymmetricRoomNames({ width: 122, height: 122 });

    expect(roomNames1[0][0]).toBe('W60N60');
    expect(roomNames1[121][0]).toBe('W60S60');
    expect(roomNames1[0][121]).toBe('E60N60');
    expect(roomNames1[121][121]).toBe('E60S60');
    expect(roomNames1[60][60]).toBe('W0N0');
    expect(roomNames1[61][60]).toBe('W0S0');
    expect(roomNames1[60][61]).toBe('E0N0');
    expect(roomNames1[61][61]).toBe('E0S0');

    const roomNames2 = await getCentrosymmetricRoomNames({ width: 64, height: 64 });

    expect(roomNames2[0][0]).toBe('W31N31');
    expect(roomNames2[63][0]).toBe('W31S31');
    expect(roomNames2[0][63]).toBe('E31N31');
    expect(roomNames2[63][63]).toBe('E31S31');
    expect(roomNames2[31][31]).toBe('W0N0');
    expect(roomNames2[32][31]).toBe('W0S0');
    expect(roomNames2[31][32]).toBe('E0N0');
    expect(roomNames2[32][32]).toBe('E0S0');
});

test('可以处理最小边界', async () => {
    const roomNames1 = await getCentrosymmetricRoomNames({ width: 2, height: 2 });

    expect(roomNames1[0][0]).toBe('W0N0');
    expect(roomNames1[1][0]).toBe('W0S0');
    expect(roomNames1[0][1]).toBe('E0N0');
    expect(roomNames1[1][1]).toBe('E0S0');
});

test('不会处理奇数房间尺寸', () => {
    const promise = getCentrosymmetricRoomNames({ width: 1, height: 1 });
    expect(promise).rejects.toThrow(/四象限布局需要地图尺寸为偶数/);
});
