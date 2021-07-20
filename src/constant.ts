/** 要绘制的 shard */
export const SCAN_SHARD = ['shard0', 'shard1', 'shard2', 'shard3']

/** 每个房间的边长像素值 */
export const ROOM_PIXEL = 20;

/** 区块由几乘几的房间组成 */
export const ROOM_PRE_SECTOR = 10;

/**
 * 放大倍数
 * 必须大于 1，因为默认情况下一个房间只有 20 像素，会影响头像显示效果，但是该值太大会降低渲染速度
 */
export const ZOOM = 3;

/** 头像边框的颜色 */
export const AVATAR_OUTLINE_COLOR = '#151515';

/** 地图指定区域的颜色 */
export const COLORS = {
    /** 未激活区域 */
    INACTIVATED: '#000000',
    /** 重生区 */
    RESPAWN: '#006bff',
    /** 新手保护区 */
    NOVICE: '#7cff7c'
};