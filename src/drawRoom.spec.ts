import { defaultRoomDrawer } from './drawRoom';
import { DrawMaterial, RoomStatus } from './type';

test('输入 undefined 返回 undefined', async () => {
    const result = await defaultRoomDrawer(undefined);
    expect(result).toBeUndefined();
});

const getSvgBuffer = async (): Promise<Buffer> => Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"></svg>'
);

test('可以正确使用头像访问器', async () => {
    const getBadge = jest.fn(getSvgBuffer);
    const getBadgeBorder = jest.fn(getSvgBuffer);

    // 没有玩家占领，不应该调用头像访问器
    const material: DrawMaterial = {
        roomName: '',
        roomInfo: { status: RoomStatus.Normal },
        getMask: getSvgBuffer,
        getRoom: getSvgBuffer,
        getBadge,
        getBadgeBorder
    };

    await defaultRoomDrawer(material);

    expect(getBadge).not.toHaveBeenCalled();
    expect(getBadgeBorder).not.toHaveBeenCalled();

    // 玩家占领，应该调用头像访问器
    material.roomInfo.own = { user: '', level: 0 };

    await defaultRoomDrawer(material);

    expect(getBadge).toBeCalledTimes(1);
    expect(getBadgeBorder).toBeCalledTimes(1);
});

test('可以正常使用蒙版访问器', async () => {
    const getMask = jest.fn(getSvgBuffer);

    const material: DrawMaterial = {
        roomName: '',
        roomInfo: { status: RoomStatus.Normal },
        getMask,
        getRoom: getSvgBuffer
    };

    await defaultRoomDrawer(material);
    expect(getMask).not.toHaveBeenCalledWith();

    const maskTypes = [
        RoomStatus.Inactivated,
        RoomStatus.Novice,
        RoomStatus.Respawn
    ];

    for (const maskType of maskTypes) {
        getMask.mockClear();
        material.roomInfo.status = maskType;
        await defaultRoomDrawer(material);
        expect(getMask).toHaveBeenCalledWith(maskType);
    }
});
