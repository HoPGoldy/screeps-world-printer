export interface ShardSize {
    width: number
    height: number
}

export interface GetMapStatsQuery {
    rooms: string[]
    shard: string
}

enum RoomStatus {
    Normal = 'normal',
    Novice = 'novice',
    Respawn = 'respawn'
}

interface RoomOwner {
    user: string
    level: number
}

interface RoomInfo {
    status: RoomStatus
    own?: RoomOwner
}

interface UserBadge {
    type: number
    color1: string
    color2: string
    color3: string
    param: number
    flip: boolean
}

interface UserInfo {
    _id: string
    username: string
    badge: UserBadge
}

export interface MapStatsResp {
    stats: {
        [roomName: string]: RoomInfo
    }
    users: {
        [userId: string]: UserInfo
    }
}