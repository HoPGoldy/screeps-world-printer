import { ScreepsWorldPrinter, getCentrosymmetricRoomNames } from "../src";

const { token, shard } = Object.fromEntries(
    process.argv
        .filter(arg => arg.startsWith('--'))
        .map(arg => arg.replace('--', ''))
        .map(arg => arg.split('='))
);

if (!token) throw new Error('无效的玩家 token，请使用 --token=your-token-here 指定令牌');
if (!shard) throw new Error('无效的 shard 名称，请使用 --shard=shard-name 指定镜面名称');


const printer = new ScreepsWorldPrinter({
    host: 'https://screeps.com/',
    token,
    shard,
}, getCentrosymmetricRoomNames);

printer.drawWorld();