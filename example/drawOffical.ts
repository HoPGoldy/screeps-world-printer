import { drawWorld, getCentrosymmetricRoomNams as getRoomNames } from '../src';

const args = Object.fromEntries(process.argv
    .filter(arg => arg.startsWith('--'))
    .map(arg => arg.replace('--', ''))
    .map(arg => arg.split('='))
);

if (!args.token) throw new Error('无效的玩家 token，请使用 --token=your-token-here 指定令牌');
if (!args.shard) throw new Error('无效的 shard 名称，请使用 --shard=shard-name 指定镜面名称');

drawWorld({
    host: 'https://screeps.com/',
    token: args.token,
    shard: args.shard || 'shard3',
    getRoomNames
});