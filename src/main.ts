import axios from "axios";
import { resolve } from "path";
import sharp from "sharp";
import { getBadge, getOfficeRoomTile, setToken } from "./service";
import { MapStatsResp } from "./type";

const run = async () => {
    // await getBadge('HoPGoldy')
    const img = await getOfficeRoomTile('shard3', 'W49S9')
    await img.toFile('./bg.png')

    const path = resolve(__dirname, `../shard3W49S9.png`)
    const roomTile = sharp(path);
    const badge = await getBadge('HoPGoldy')
    return;
    const blendTypes: sharp.Blend[] = ["clear"
   , "source"
   , "over"
   , "in"
   , "out"
   , "atop"
   , "dest"
   , "dest-over"
   , "dest-in"
   , "dest-out"
   , "dest-atop"
   , "xor"
   , "add"
   , "saturate"
   , "multiply"
   , "screen"
   , "overlay"
   , "darken"
   , "lighten"
   , "colour-dodge"
   , "colour-dodge"
   , "colour-burn"
   , "colour-burn"
   , "hard-light"
   , "soft-light"
   , "difference"
   , "exclusion"]
   return;
   blendTypes.map(blend => roomTile.composite([{ input: badge, blend }]).toFile(`./result-${blend}.png`))
}

// const drawRoom = async function (roomName: string) {
//     const 
// }`

const formatRoomData = function (roomStats: MapStatsResp) {
    console.log(JSON.stringify(roomStats.users['583c8ab1445866cb4ad0a321'], null, 4))
}

run()