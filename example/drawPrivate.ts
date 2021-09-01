import { drawWorld, getDefaultServerRoomNames as getRoomNames } from '../src';

drawWorld({
    host: 'http://127.0.0.1:21025',
    getRoomNames
});
