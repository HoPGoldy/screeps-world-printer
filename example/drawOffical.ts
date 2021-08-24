import { drawWorld, getCentrosymmetricRoomNams as getRoomNames } from '../src';
import { readFileSync } from 'fs';

let token
try {
    token = readFileSync('.officeToken').toString();
}
catch (e) {
    throw new Error('无效的玩家 token，请在根目录下新建文件 .officeToken 并填入 token');
}

drawWorld({
    host: 'https://screeps.com/',
    token,
    shard: 'shard3',
    roomTileCdn: 'https://d3os7yery2usni.cloudfront.net',
    getRoomNames
});