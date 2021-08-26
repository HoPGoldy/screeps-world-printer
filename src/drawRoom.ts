import sharp, { Sharp, OverlayOptions } from "sharp";
import { BADGE_RESIZE_WITH_LEVEL, ROOM_MASK_COLORS } from "./constant";
import { DrawMaterial, RoomStatus } from "./type";
import { addOpacity } from "./utils";
import { map } from 'async';

type DrawProcessor = (roomTile: Sharp, material: DrawMaterial) => Promise<OverlayOptions | undefined>

/**
 * 绘制单个房间
 * 
 * @param material 房间绘制素材
 * @returns 单个房间的最终图像 Buffer
 */
export const drawRoom = async function (material: DrawMaterial): Promise<Buffer> {
    const roomTile = sharp(await material.getRoom());
    // 蒙版在前，头像在后，不然头像会被蒙版盖住
    const pipeline = [maskProcessor, badgeProcessor];

    // 运行流水线获取要叠加的图层
    const compositeOverlays = (await map<DrawProcessor, OverlayOptions>(pipeline, async processor => {
        return await processor(roomTile, material)
    })).filter(Boolean);

    // 将图层叠加到地图瓦片上获取最后的成果图像
    return roomTile.composite(compositeOverlays).toBuffer();
}

/**
 * 获取蒙版图层
 * 房间的新手区 / 重生区 / 未激活的颜色蒙版
 */
const maskProcessor: DrawProcessor = async function (roomTile, material) {
    if (material.roomInfo.status === RoomStatus.Normal) return undefined; 

    const { width: roomTileWidth, height: roomTileHeight } = await roomTile.metadata();
    if (!roomTileWidth || !roomTileHeight) {
        throw new Error(`无效的房间瓦片尺寸 ${material.roomName} ${roomTileWidth} ${roomTileHeight}`);
    }
    // 使用配置的背景色
    const background = ROOM_MASK_COLORS[material.roomInfo.status];
    // 添加一个半透明的纯色蒙版
    const mask = sharp({
        create: { width: roomTileWidth, height: roomTileHeight, channels: 3, background }
    }).ensureAlpha(0.5).png();

    return { input: await mask.toBuffer(), blend: 'atop' };
}

/**
 * 获取头像图层
 * 渲染房间对应的头像，以及对头像进行缩放和透明度处理
 */
const badgeProcessor: DrawProcessor = async function (roomTile, material) {
    if (!material.getBadge) return undefined;
    
    const rawBadge = await material.getBadge();
    const badgeSharp = sharp(rawBadge);
    const { width: rawBadgeWidth } = await badgeSharp.metadata();
    const ownLevel = material.roomInfo.own?.level;

    // level 有可能为 0，所以需要特判一下
    if (!rawBadgeWidth || ownLevel == undefined) {
        throw new Error(`房间 ${material.roomName} 的头像宽度 ${rawBadgeWidth} 或玩家等级 ${ownLevel} 为空`);
    }

    // 根据房间等级缩放头像大小
    const resizeWidth = Math.ceil(rawBadgeWidth * BADGE_RESIZE_WITH_LEVEL[ownLevel]);
    let badge = badgeSharp.resize(resizeWidth);
    // 外矿的话就添加半透明
    if (ownLevel === 0) badge = addOpacity(badgeSharp, 128);
    
    return { input: await badge.toBuffer(), blend: 'atop' };
}