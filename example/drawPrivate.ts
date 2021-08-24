import { drawWorld } from '../src';

drawWorld({
    host: 'https://server2.screepspl.us/',
    getRoomNames: async (roomInfo) => {
        console.log('🚀 ~ file: drawOfficalServer.ts ~ line 10 ~ getRoom: ~ roomInfo', roomInfo)
        return [['string']]
    }
});