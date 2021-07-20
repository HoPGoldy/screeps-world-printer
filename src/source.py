import json
from os import path, makedirs
import time
import math
from io import BytesIO

from PIL import Image, ImageDraw, UnidentifiedImageError
import cairosvg
import requests

from simple_bar import Bar

# 每个房间的边长像素值
ROOM_PIXEL = 20
# 区块由几乘几的房间组成
ROOM_PRE_SECTOR = 10
# 放大倍数，必须大于 1，因为默认情况下一个房间只有 20 像素，会影响头像显示效果，但是该值太大会降低渲染速度
ZOOM = 3
# shard0 在放大 3 倍后的像素值，注释本行会引起 pillow 的 DecompressionBombWarning 警告
Image.MAX_IMAGE_PIXELS = 144000001
# 头像边框的颜色
AVATAR_OUTLINE_COLOR = '#151515'
# 地图指定区域的颜色
COLORS = {
    # 未激活区域
    "inactivated": '#000000',
    # 重生区
    "respawn": '#006bff',
    # 新手保护区
    "novice": '#7cff7c'
}

class ScreepsWorldView:
    # 要绘制的 shard，在初始化时会修改为指定的值
    shard = 3
    # 持有的地图 Image 对象
    background = None
    # 头像缓存路径
    avatar_path = '.screeps_cache/avatar'
    # 缓存路径
    cache_path = None
    # 成果路径
    dist_path = None
    # 世界尺寸信息，在 _init_world 中初始化
    shard_info = None
    # 房间信息，用于在底图上添加用户头像，键为房间名，值为房间配置信息
    rooms = None
    # 地图中出现的用户名，用于下载头像
    users = None
    # 所有的用户名头像设置，键为玩家名，值为玩家的头像设置字符串
    avatars_setting = None
    # 结果文件名
    result_name = ''

    def __init__(self, shard=3):
        self.shard = shard
        
        print(f'--- 开始绘制 Screeps Shard{shard} {self.result_name} ---')
        # 没有缓存的话就新建缓存路径
        if not path.exists('.screeps_cache'):
            self._init_cache_folder()

        # 初始化内部属性
        self.cache_path = f'.screeps_cache/{shard}'
        self.dist_path = f'dist/{shard}'
        self.shard_info = {}
        self.rooms = {}
        self.users = []
        self.avatars_setting = {}
        self.result_name = time.strftime('%Y-%m-%d', time.localtime(time.time()))

        # 初始化世界
        self._init_world()

        # 初始化地图实例
        if path.exists(f'{self.cache_path}/background.png'):
            self.background = Image.open(f'{self.cache_path}/background.png')
            print('使用缓存地图 ✔')
        else:
            self.background = self.draw_background()


    def draw(self):
        """绘制地图
        
        入口方法，会自动完成地图绘制工作
        """
        self.get_world_stats()
        self.get_avatar()
        self.draw_world()


    def _init_cache_folder(self):
        """初始化所需文件夹
        会初始化缓存文件夹和成果文件夹
        """
        for shard_name in [ '0', '1', '2', '3']:
            for type_name in [ 'room' ]:
                makedirs(f'.screeps_cache/{shard_name}/{type_name}')
            
            # 创建结果文件夹
            dist_path = f'dist/{shard_name}'
            if not path.exists(dist_path): makedirs(dist_path)
        # 头像缓存目录
        makedirs(f'.screeps_cache/avatar')
        # print('缓存目录创建成功')


    def draw_background(self):
        """绘制底图
        下载区块瓦片，并拼接成整个世界底图
        该方法会自动将底图缓存起来
        Returns:
            Image: 绘制好的世界底图
        """

        # 新建空白底图，注意这里并没有使用缩放，而是直接使用默认 dpi 进行拼接
        background = Image.new('RGBA', (self._get_sector_num() * ROOM_PIXEL * ROOM_PRE_SECTOR,) * 2, (0xff,) * 4)

        x_sectors_name, y_sectors_name = self._get_sectors_name()
        total_sector_num = len(x_sectors_name) * len(y_sectors_name)
        bar = Bar('正在下载房间')
        
        # 遍历所有瓦片进行下载并粘贴到指定位置
        for x in range(len(x_sectors_name)):
            for y in range(len(y_sectors_name)):
                sector_name = x_sectors_name[x] + y_sectors_name[y]
                sector_img_path = f'{self.cache_path}/room/{sector_name}.png'
                # 更新进度
                bar.update(f'{sector_name} {len(y_sectors_name) * x + y + 1}/{total_sector_num}')

                # 有缓存的话直接用，底图永远不会发生变化
                if path.exists(sector_img_path):
                    img = Image.open(sector_img_path)
                else:
                    img = Image.open(BytesIO(requests.get(f'https://d3os7yery2usni.cloudfront.net/map/shard{self.shard}/zoom1/{sector_name}.png').content))
                    img.save(sector_img_path)
                background.paste(img, (x * ROOM_PIXEL * ROOM_PRE_SECTOR, y * ROOM_PIXEL * ROOM_PRE_SECTOR))

        bar.close()

        # 缩放为指定大小
        background = self._resize(background)
        # 保存下载供以后使用
        background.save(f'{self.cache_path}/background.png')

        return background


    def draw_world(self):
        """绘制用户信息
        将用户头像及区域添加到底图上
        Returns:
            self: 自身
        """
        bar = Bar('正在绘制世界')

        sector_num = self._get_sector_num()

        # 从像素角度挨个遍历所有房间进行绘制
        for x in range(0, sector_num * ROOM_PRE_SECTOR * ROOM_PIXEL * ZOOM, ROOM_PIXEL * ZOOM):
            for y in range(0, sector_num * ROOM_PRE_SECTOR * ROOM_PIXEL * ZOOM * 2, ROOM_PIXEL * ZOOM):
                room_name = self._pixel2room((x, y))
                bar.update(room_name)

                if room_name not in self.rooms:
                    continue
                room = self.rooms[room_name]

                # 绘制区域
                if room['status'] == 'out of borders':
                    self.add_inactivated_mask(x, y, 'inactivated')
                elif room['status'] == 'respawn':
                    self.add_inactivated_mask(x, y, 'respawn')
                elif room['status'] == 'novice':
                    self.add_inactivated_mask(x, y, 'novice')
                
                # 将用户头像贴上去
                if 'owner' in room:
                    avatar = self._draw_avatar(room['owner'], rcl=room['rcl'])
                    if not avatar: continue
                    # 粘贴到指定位置
                    self.background.paste(avatar, (x + int(((ROOM_PIXEL * ZOOM) - avatar.size[0]) / 2), y + int(((ROOM_PIXEL * ZOOM) - avatar.size[1]) / 2)), mask=avatar)

        bar.update('保存中')
        # 按照日期进行保存
        result_path = f'{self.dist_path}/{self.result_name}.png'
        self.background.save(result_path)
        bar.close()

        print(f'已保存至 {result_path}')
        return self


    def _resize(self, background):
        """放大底图
        更好的放大，Image.resize 会导致底图失真
        Args:
            background: Image 要放大的底图
        Returns:
            Image 放大后的底图
        """
        size = background.size
        new_background = Image.new('RGBA', (self._get_sector_num() * ROOM_PIXEL * ROOM_PRE_SECTOR * ZOOM,) * 2, (0xff,) * 4)

        bar = Bar('正在放大底图')
        # 遍历所有行
        for y in range(size[1]):
            row = []
            # 把每个像素复制 ZOOM 份
            for x in range(size[0]):
                for _ in range(ZOOM):
                    row.append(background.getpixel((x, y)))
            # 把每个扩充好的行重复粘贴 ZOOM 份
            for new_y in range(ZOOM * y - ZOOM, ZOOM * y):
                for new_x, pixel in enumerate(row):
                    # print(new_x, new_y, pixel)
                    new_background.putpixel((new_x, new_y), pixel)
            bar.update(f'{y}/{size[1]}')
        bar.close()

        return new_background

    
    def _draw_avatar(self, player, rcl=8):
        """绘制指定玩家的头像
        
        Args:
            player: string 要绘制的玩家名
            rcl: 0-8 要绘制的 rcl 等级
        Return:
            Image: 绘制好的玩家头像
        """
        avatar_path = f'{self.avatar_path}/{player}.png'
        if path.exists(avatar_path):
            # 外矿的话就比占领房间要小一号（没有按房间等级进行绘制）
            correct_size = (6 * ZOOM, 6 * ZOOM) if rcl == 0 else (10 * ZOOM, 10 * ZOOM)
            try:
                avatar = Image.new('RGBA', (correct_size[0] + 3, correct_size[1] + 2))
                origin = Image.open(avatar_path).resize(correct_size)
                avatar.paste(origin, (1, 1), mask=origin)
                
                # 如果是外矿的话就透明一下
                if rcl == 0:
                    mask = Image.new('RGBA', avatar.size)
                    avatar = Image.blend(avatar, mask, 0.3)

                # 绘制边框
                avatar_draw = ImageDraw.Draw(avatar)
                # 下面 avatar.size[0] - 1 是因为默认情况下会头像会和边框留有一点缝隙
                avatar_draw.ellipse((0, 0, avatar.size[0] - 1, avatar.size[1]), outline=AVATAR_OUTLINE_COLOR, width=2)

                return avatar
            except UnidentifiedImageError:
                print(f'头像失效 - {avatar_path}')
                return None
        else:
            print(f'未找到头像 - {avatar_path}')
            return None


    def _get_room_name(self):
        """获取所有房间名
        按照房间尺寸遍历出所有房间名
        Returns:
            array: 所有的房间名列表
        """
        quadrant_size = self._get_quadrant_size()

        name_x = [f'W{i}' for i in range(0, quadrant_size)] + [f'E{i}' for i in range(0, quadrant_size)]
        name_y = [f'S{i}' for i in range(0, quadrant_size)] + [f'N{i}' for i in range(0, quadrant_size)]
        return [x + y for x in name_x for y in name_y]


    def get_world_stats(self):
        """获取房间信息
        登陆后获取整个世界的房间信息，会将房间信息保存到 self.rooms 中
        Returns:
            self: 自身
        """
        bar = Bar('正在加载世界信息')
        time.sleep(0.1)

        with open("config.json") as auth:
            d = json.load(auth)
            username = d["username"]
            password = d["password"]
        
        # 进行登陆
        r = requests.post('https://screeps.com/api/auth/signin', json={'email': username, 'password': password})
        r.raise_for_status()
        token = json.loads(r.text)["token"]

        # 登陆后获取所有房间的信息
        # 这里可能比较慢，所以调大了超时时间
        params = {'rooms': self._get_room_name(), 'shard': f'shard{self.shard}', 'statName': 'owner0'}
        r = requests.post('https://screeps.com/api/game/map-stats', json=params, headers={ 'X-Token': token, 'X-Username': token }, timeout=120)
        token = r.headers["X-Token"]

        # 将获取到的信息格式化成需要的样子
        self._format_room(json.loads(r.text))
        bar.close()
        return self


    def _format_room(self, world_stats):
        """格式化房间信息
        Args:
            world_stats: self.get_world_stats() 获取到的房间信息
        
        Returns:
            self: 自身
        """
        now_timestamp = int(time.time()) * 1000

        for room_name in world_stats["stats"]:
            room = world_stats["stats"][room_name]
            self.rooms[room_name] = {
                "status": room["status"]
            }
            if ("own" in room):
                user_id = room["own"]["user"]
                user_info = world_stats["users"][user_id]

                self.rooms[room_name]["owner"] = user_info["username"]
                self.rooms[room_name]["rcl"] = room["own"]["level"]

                # 把用户加入用户列表中
                if (self.rooms[room_name]["owner"] not in self.users):
                    self.users.append(self.rooms[room_name]["owner"])
                    # 保留用户头像设置
                    self.avatars_setting[self.rooms[room_name]["owner"]] = json.dumps(user_info["badge"])
            
            # 尚不清楚新手区和重生区的渲染规则
            if 'novice' in room and room['novice'] and room['novice'] >= now_timestamp:
                self.rooms[room_name]["status"] = 'novice'
            elif 'respawnArea' in room and room['respawnArea'] and room['respawnArea'] >= now_timestamp:
                self.rooms[room_name]["status"] = 'respawn'

        return self


    def get_avatar(self):
        """下载头像
        会遍历 self.users 并下载对应的头像，该方法会自动缓存下载好的头像，并在后续使用时通过 badge 的配置变动来局部更新头像
        Returns:
            self: 自身
        """
        avatars_setting_json_path = f'{self.avatar_path}/shard{self.shard}_player_setting.json'

        # 获取之前缓存的玩家头像配置，用于和最新的用户设置做比对，如果有不同则更新其头像，否则使用缓存好的头像
        cache_avatars_setting = None
        if path.exists(avatars_setting_json_path):
            with open(avatars_setting_json_path) as avatars:
                cache_avatars_setting = json.loads(avatars.read())

        bar = Bar('下载头像')
        for i, username in enumerate(self.users):
            avatar_path = f'{self.avatar_path}/{username}.png'
            bar.update(f'{username} {i + 1}/{len(self.users)}')

            # 头像存在就比较头像配置是否相同，完全一样就不需要下载
            if path.exists(avatar_path) and cache_avatars_setting and username in cache_avatars_setting and self.avatars_setting[username] == cache_avatars_setting[username]:
                continue
            else:
                svg = requests.get(f'https://screeps.com/api/user/badge-svg?username={username}').content
                cairosvg.svg2png(bytestring=svg, write_to=avatar_path)

        # 把最新的用户配置保存下来供下次绘制时使用
        with open(avatars_setting_json_path, 'w') as avatars:
            avatars.write(json.dumps(self.avatars_setting))

        bar.close()
        return self


    def _pixel2room(self, pos):
        """将像素位置转换为房间名
        Args:
            pos: tuple, 包含位置的 x y 值，如 (1400, 1400)
        
        Returns:
            string, 该位置所在的房间名称
        """
        room = ''
        quadrant_size = self._get_quadrant_size()
        pos_direction = ( ('E', 'W'), ('S', 'N'))
        
        for i, axis in enumerate(pos):
            code = quadrant_size - axis / (ROOM_PIXEL * ZOOM)
            # 根据 code 的正负判断其所在象限
            room += f'{pos_direction[i][0]}{math.floor(-code)}' if code <= 0 else f'{pos_direction[i][1]}{math.floor(code - 1)}'

        return room


    def add_inactivated_mask(self, x, y, mask_type='inactivated'):
        """在指定位置添加未开放房间蒙版
        
        Args:
            x: 要添加到的房间左上角的 x 轴像素位置
            y: 要添加到的房间左上角的 y 轴像素位置
            mask_type: 蒙版类型, inactivated respawn novice 三者之一
        Returns:
            self 自身
        """
        size = ROOM_PIXEL * ZOOM
        mask = Image.new('RGBA', (size, size), COLORS[mask_type])
        # 取出指定位置的房间
        room = self.background.crop((x, y, x + size, y + size))
        # 将取出的位置和蒙版贴在一起然后粘回去
        self.background.paste(Image.blend(room, mask, 0.3), (x, y))

        return self

    
    def _init_world(self):
        """初始化世界信息
        会加载世界的尺寸，没有返回值
        """
        bar = Bar('正在加载世界尺寸')
        self.shard_info = json.loads(requests.get(f'https://screeps.com/api/game/world-size?shard=shard{self.shard}').content)
        bar.close()

    def _get_sectors_name(self):
        """获取区块名称数组
        需要调用 self._init_world()
        将会获取该世界的区块名称（区块右下角的房间名），可以用该名称来下载区块地图
        Return:
            x_sectors_name, y_sectors_name: 房间名列表，两两相加即可获得最终房间名
        """
        shard_info = self.shard_info
        
        x_sectors_name = []
        for x in range(0, int(shard_info['width'] / 2), 10):
            x_sectors_name.append(f'W{x + 9}')
        x_sectors_name.reverse()
        for x in range(0, int(shard_info['width'] / 2), 10):
            x_sectors_name.append(f'E{x}')
        
        y_sectors_name = []
        for y in range(0, int(shard_info['height'] / 2), 10):
            y_sectors_name.append(f'N{y + 9}')
        y_sectors_name.reverse()
        for y in range(0, int(shard_info['height'] / 2), 10):
            y_sectors_name.append(f'S{y}')

        return x_sectors_name, y_sectors_name

    
    def _get_quadrant_size(self):
        """获取象限边长对应的房间数量
        需要调用 self._init_world()
        该方法将 screeps 世界视作一个正方形（随便官方并没有确切的这么说），并使用世界的**宽度**计算其边长对应的房间数量
        Return:
            array: 返回每个象限边长对应的房间数量
        """
        return int((self.shard_info['width'] + 9 * 2 ) / 2)
    
    def _get_sector_num(self):
        """获取整个世界边长对应的区块数量
        需要调用 self._init_world()
        Return:
            number: 区块数量
        """
        return int((self.shard_info['width'] + 9 * 2) / ROOM_PRE_SECTOR)