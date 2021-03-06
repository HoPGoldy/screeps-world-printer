import { Presets, SingleBar } from 'cli-progress';
import EventEmitter from 'events';
import { getCentrosymmetricRoomNames, getDefaultServerRoomNames } from '.';
import { CacheManager } from './cache';
import { drawWorld, fetchWorld } from './core';
import { defaultRoomDrawer } from './drawRoom';
import { ScreepsService } from './service';
import {
    DrawContext, PrintEvent, PrintEventListeners, ResultSaver,
    RoomDrawer, RoomNameGetter, ServerConnectInfo, WorldDataSet
} from './type';
import { getDefaultSaver } from './utils';

/**
 * 绘制 screeps 世界地图
 */
export class ScreepsWorldPrinter extends EventEmitter {
    /**
     * 服务器连接信息
     */
    private readonly connectInfo: ServerConnectInfo;

    /**
     * 用于获取本地图的具体房间名数组
     */
    private roomNameGetter: RoomNameGetter;

    /**
     * 房间绘制器
     */
    private roomDrawer: RoomDrawer = defaultRoomDrawer;

    /**
     * 结果保存器
     */
    private resultSaver?: ResultSaver;

    /**
     * 访问服务器的请求类
     */
    public readonly service: ScreepsService;

    /**
     * 访问本地缓存的管理类
     */
    public readonly cache: CacheManager;

    /**
     * 默认添加的日志回调数组
     * 保存在这里用于取消监听时调用
     */
    private logListener: PrintEventListeners = {};

    /**
     * 下载进度条
     */
    private downloadBar?: SingleBar;

    /**
     * 绘制进度条
     */
    private drawBar?: SingleBar;

    /**
     * 实例化地图绘对象
     *
     * @param connectInfo 服务器连接信息
     * @param getRoomNames 房间名解析器，从世界尺寸获取房间名二维数组的异步函数
     */
    constructor (connectInfo: ServerConnectInfo, roomNameGetter?: RoomNameGetter) {
        super();

        if (roomNameGetter) this.roomNameGetter = roomNameGetter;
        else {
            // 根据连接信息选用默认的房间名解析器
            this.roomNameGetter = ('token' in connectInfo || 'shard' in connectInfo)
                ? getCentrosymmetricRoomNames
                : getDefaultServerRoomNames;
        }
        this.connectInfo = connectInfo;

        this.service = new ScreepsService(connectInfo);
        const cacheKey = connectInfo.host + ('shard' in connectInfo ? connectInfo.shard : '');
        this.cache = new CacheManager(cacheKey);

        this.talkative();
    }

    /**
     * 开启日志输出
     * 默认开启
     */
    talkative (): ScreepsWorldPrinter {
        if (Object.keys(this.logListener).length > 0) return this;

        const downlaodFormat = '下载进度 {bar} {percentage}% {value}/{total}';
        const downlaodBar = new SingleBar({ format: downlaodFormat, fps: 1 }, Presets.legacy);

        const drawFormat = '拼接进度 {bar} {percentage}% {value}/{total}';
        const drawBar = new SingleBar({ format: drawFormat, fps: 1 }, Presets.legacy);

        const logListener: PrintEventListeners = {
            [PrintEvent.BeforeFetchSize]: ({ host, shard }) => {
                console.log(`开始绘制 ${host} ${shard ?? ''} 的世界地图`);
                console.log('正在加载地图尺寸');
            },
            [PrintEvent.BeforeFetchWorld]: () => {
                console.log('正在获取世界信息');
            },
            [PrintEvent.BeforeDownload]: ({ roomStats }) => {
                console.log('正在下载素材');
                downlaodBar.start(Object.keys(roomStats.stats).length, 0);
            },
            [PrintEvent.Download]: () => downlaodBar.increment(),
            [PrintEvent.AfterDownload]: () => downlaodBar.stop(),
            [PrintEvent.BeforeDraw]: ({ dataSet }) => {
                console.log('正在绘制地图');
                const total = dataSet.roomMaterialMatrix.reduce((total, row) => total + row.length, 0);
                drawBar.start(total, 0);
            },
            [PrintEvent.Draw]: () => drawBar.increment(),
            [PrintEvent.AfterDraw]: () => drawBar.stop(),
            [PrintEvent.BeforeSave]: () => {
                console.log('正在保存结果');
            },
            [PrintEvent.AfterSave]: ({ savePath }) => {
                console.log(`绘制完成，结果已保存至 ${savePath}`);
            }
        };
        this.addPrintListener(logListener);

        this.logListener = logListener;
        this.downloadBar = downlaodBar;
        this.drawBar = drawBar;

        return this;
    }

    /**
     * 关闭日志输出
     */
    silence (): ScreepsWorldPrinter {
        Object.entries(this.logListener).forEach(
            ([event, listener]) => this.off(event, listener)
        );
        this.logListener = {};

        this.stopLogBar();
        this.downloadBar = this.drawBar = undefined;
        return this;
    }

    /**
     * 设置名称获取器
     * 将覆盖实例化时传入的获取器
     *
     * @param roomNameGetter 新的名称获取器
     */
    setRoomNameGetter (roomNameGetter: RoomNameGetter): ScreepsWorldPrinter {
        this.roomNameGetter = roomNameGetter;
        return this;
    }

    /**
     * 设置房间绘制器
     * 将在每次房间绘制时调用，将覆盖默认绘制行为
     *
     * @param roomDrawer 新的房间绘制器
     */
    setRoomDrawer (roomDrawer: RoomDrawer): ScreepsWorldPrinter {
        this.roomDrawer = roomDrawer;
        return this;
    }

    /**
     * 设置结果保存器
     * 将覆盖默认的保存器
     *
     * @param resultSaver 新的结果保存器
     */
    setResultSaver (resultSaver: ResultSaver): ScreepsWorldPrinter {
        this.resultSaver = resultSaver;
        return this;
    }

    /**
     * 监听事件：进度推进
     */
    addPrintListener (callbacks: PrintEventListeners): ScreepsWorldPrinter {
        Object.entries(callbacks).forEach(
            ([event, callback]) => this.on(event, callback)
        );
        return this;
    }

    /**
     * 绘制世界地图并进行保存
     * 可以使用 .setRoomDrawer 和 .setResultSaver 来自定义保存行为
     *
     * @returns 结果保存路径
     */
    async drawWorld (): Promise<string> {
        try {
            const context = await this.createDrawContext();
            const dataSet = await fetchWorld(context);
            return await drawWorld(dataSet, context);
        }
        catch (e) {
            this.stopLogBar();
            throw e;
        }
    }

    /**
     * 获取世界绘制素材
     * 仅下载素材不进行绘制，将不会执行 .setRoomDrawer 和 .setResultSaver 设置的行为
     * 并且不会触发后面的绘制和保存回调
     *
     * @returns 下载好的世界绘制素材
     */
    async fetchWorld (): Promise<WorldDataSet> {
        try {
            const context = await this.createDrawContext();
            return await fetchWorld(context);
        }
        catch (e) {
            this.stopLogBar();
            throw e;
        }
    }

    /**
     * 根据当前的设置生成绘制上下文
     */
    private async createDrawContext (): Promise<DrawContext> {
        const saveResult = this.resultSaver
            ? this.resultSaver
            : await getDefaultSaver(this.connectInfo);

        return {
            getRoomNames: this.roomNameGetter,
            drawRoom: this.roomDrawer,
            saveResult,
            service: this.service,
            cache: this.cache,
            emitter: this
        };
    }

    /**
     * 停止日志进度条输出（如果开启了的话）
     */
    private stopLogBar (): void {
        this.downloadBar?.stop();
        this.drawBar?.stop();
    }
}
