import axios from "axios";
import { getBadge, getRoomBackground, setToken } from "./service";
import { MapStatsResp } from "./type";

const run = async () => {
        // await getBadge('HoPGoldy')
        const img = await getRoomBackground('shard3', 'W49S9')
        await img.toFile('./bg.png')
}

// const drawRoom = async function (roomName: string) {
//     const 
// }`

const formatRoomData = function (roomStats: MapStatsResp) {
    console.log(JSON.stringify(roomStats.users['583c8ab1445866cb4ad0a321'], null, 4))
}

run()