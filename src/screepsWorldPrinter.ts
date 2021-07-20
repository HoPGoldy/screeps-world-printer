import { resolve } from 'path'
import { getShardInfo } from './service'
import { ShardSize } from './type'

class ScreepsWorldView {
    shardName: string = 'shard3'
    resultName: string = ''
    cachePath: string = ''
    distPath: string = ''
    shardSize: ShardSize

    constructor(shardName: string) {
        this.shardName = shardName
        this.cachePath = resolve(__dirname, `../.screeps_cache/${shardName}`)
        this.distPath = resolve(__dirname, `../dist/${shardName}`)

        console.log(`--- 开始绘制 Screeps Shard${shardName} ${this.resultName} ---`)
    }

    async init() {
        console.log('正在加载世界尺寸')
        this.shardSize = await getShardInfo(this.shardName)
    }
}
