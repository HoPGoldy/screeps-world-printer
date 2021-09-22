import { ScreepsWorldPrinter } from "../src";
import { getArgs } from "./utils";

const { host, username, password } = getArgs();

if (!host) console.log('未发现服务器，将使用本地默认服务器');
if (!username) throw new Error('无效的玩家名，请使用 --username=your-username-here 指定名称');
if (!password) throw new Error('无效的密码，请使用 --shard=password-name 指定密码');


const printer = new ScreepsWorldPrinter({
    host: host || 'http:127.0.0.1:21025',
    username,
    password,
});

printer.drawWorld();