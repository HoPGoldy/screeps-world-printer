import { ScreepsWorldPrinter, getCentrosymmetricRoomNames } from "../src";
import { getArgs } from "./utils";

const { token, shard } = getArgs();

if (!token) throw new Error('无效的玩家 token，请使用 --token=your-token-here 指定令牌');
if (!shard) throw new Error('无效的 shard 名称，请使用 --shard=shard-name 指定镜面名称');


const printer = new ScreepsWorldPrinter({
    host: 'https://screeps.com/',
    token,
    shard,
}, getCentrosymmetricRoomNames);

printer.drawWorld();