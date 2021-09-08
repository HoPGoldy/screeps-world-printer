import { getDefaultServerRoomNames } from '../utils';

test('可以生成房间名', async () => {
    const roomNames = await getDefaultServerRoomNames({ width: 11, height: 11 });

    expect(roomNames[0][0]).toBe('W10N10');
    expect(roomNames[10][0]).toBe('W10N0');
    expect(roomNames[0][10]).toBe('W0N10');
    expect(roomNames[10][10]).toBe('W0N0');
    expect(roomNames[5][5]).toBe('W5N5');
});

test('可以处理最小边界', async () => {
    const roomNames1 = await getDefaultServerRoomNames({ width: 1, height: 1 });

    expect(roomNames1[0][0]).toBe('W0N0');
});
