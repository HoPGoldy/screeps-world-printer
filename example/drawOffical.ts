import { ScreepsWorldPrinter } from "../src";
import { getArgs } from "./utils";

const { token, shard } = getArgs();

if (!token) throw new Error('无效的玩家 token，请使用 --token=your-token-here 指定令牌');


const printer = new ScreepsWorldPrinter({
    host: 'https://screeps.com/',
    token,
    shard: shard ?? 'shard3',
});

printer.drawWorld();
