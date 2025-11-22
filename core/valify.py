import math

def valify(actions, N, score, seed):
    rng = Mulberry32(seed)
    STATUS= {
        'EMPTY': 0,
        'OFF'  : 1,
        'ON'   : 2,
    }
    context = {
        'max' : 1,
        'N'   : N,
        'cnt_empty' : N*N-1,
        'lastClickedNode' : None,
        'adjacent' : [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]],
        'STATUS' : STATUS
    }
    tiles = []
    for row in range(N):
        tiles.append([])
        for col in range(N):
            tiles[row].append(Node(col,row,context))
    tiles[0][0].value = 1
    tiles[0][0].status = context['STATUS']['OFF']
    context['map'] = tiles



    # print(actions)
    k = 0
    val_server = 1
    for action in actions:

        # print(f'{k}th....')

        x_dest = action['x_dest']
        y_dest = action['y_dest']
        x_from = action['x_from']
        y_from = action['y_from']
        val = action['val']
        

        if val != val_server:
            print(f'at {k}th...')
            print('val dismatch...')
            print('seed:',seed)
            print('vals_from_action:',val,'/val_server:',val_server)
            print('max_from_action:',action['max_value'],'/max_server:',context['max'])
            # print('max:',context['max'])
            # print('r:', r)
            # rng_temp = Mulberry32(seed)
            # print([rng_temp.random() for i in range(5)])
            return False
        if (y_from >= -1) and (x_from >= -1):
            # print(f'from x,y:{x_from}, {y_from}')
            tiles[y_from][x_from].clicked(val)
        tiles[y_dest][x_dest].clicked(val)
        # print('cur_action:',action)
        # print('server_ret:',context)
        r = rng.random()
        val_server = math.floor(r * math.floor(context['max']/2))+1
        k+=1
    if context['max'] != score:
        return False
    return True
        

class Mulberry32:
    def __init__(self, seed: int):
        self.a = int(seed) & 0xFFFFFFFF  # 내부 상태

    @staticmethod
    def imul(x, y):
        return ((x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)) & 0xFFFFFFFF

    def random(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF   # ← 오직 이 한 줄로 상태 갱신
        t = self.a
        t = self.imul(t ^ (t >> 15), t | 1)
        t ^= (t + self.imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        t ^= t >> 14
        return (t & 0xFFFFFFFF) / 4294967296.0

class Node:
        def __init__(self, x, y, context:dict, value=None, parent=None):
            self.context = context
            self.x = x
            self.y = y
            self.value  = value
            self.child  = []
            self.tempChilds =[]
            self.parent = parent
            self.status = self.context['STATUS']['EMPTY']
            if value:
                self.status = self.context['STATUS']['OFF']
        def reset(self):
            if self.status != self.context['STATUS']['EMPTY']:
                self.context['cnt_empty'] += 1
            self.parent = None
            self.status = self.context['STATUS']['EMPTY']
            self.value = None
        def status_Changed(self):
            
            if self.value is None: return
            if self.value > self.context['max']:
                self.context['max'] = self.value
                # print(f'max_changed:{self.context['max']}')
            #########################
            # print('check_parent...')
            # print(f'cur: {self.x},{self.y}')
            if len(self.child) > 0:
                self.checkChilds()
            elif (len(self.child) == 0) and (self.parent != None):
                # print(f'parent: {self.parent.x},{self.parent.y}')
                self.parent.checkChilds()
        def permutation(self, nodes, acc, cur, target, nodes_rets:list):

                if acc == target:
                    return True
                if cur >= len(nodes):
                    return False
                if acc > target:
                    return False
                visit = False

                nodes_rets.append(nodes[cur])
                visit = self.permutation(nodes, acc+nodes[cur].value, cur+1, target, nodes_rets)
                if visit: return True
                nodes_rets.pop()
                visit = self.permutation(nodes, acc, cur+1, target, nodes_rets)
                return visit
            
        def checkChilds(self):
        
            node_changed:list[Node] = []
            possibles = []

            for c in self.child:
                if len(c.child) > 0:
                    continue
                possibles.append(c)

            if self.permutation(possibles, 0, 0, self.value, node_changed):

                self.value *= 2

                for node in node_changed:
                    node.reset()
                temp = []
                for c in self.child:
                    if c.status==self.context['STATUS']['EMPTY']:
                        continue
                    temp.append(c)
                self.child = temp

                node_changed.append(self)
                for node in node_changed:
                   node.status_Changed()
        def unset_on_titles(self):
            if self.context['lastClickedNode']:
                lastClickedNode = self.context['lastClickedNode']
                node_changed = []
                for node in lastClickedNode.tempChilds:
                    if node.status==self.context['STATUS']['ON']:
                        node.status = self.context['STATUS']['EMPTY']
                        node_changed.append(node)
                for node in node_changed:
                    node.status_Changed()
        def clicked(self, val):
            if self.status == self.context['STATUS']['EMPTY']:
                return
            if self.value == val:
                self.unset_on_titles()
                self.value += val
                self.status_Changed()
                return
            if self.status == self.context['STATUS']['OFF']:
                self.unset_on_titles()
                if len(self.child) >= 3:
                    return
                self.tempChilds = []
                # print('#####################################')
                # print(f'from {self.x},{self.y}')
                for cur in self.context['adjacent']:
                    cur_x = self.x + cur[0]
                    cur_y = self.y + cur[1]
                    if cur_x < 0 or cur_x >= self.context['N'] or cur_y < 0 or cur_y >= self.context['N']: continue

                    adjacent_node = self.context['map'][cur_y][cur_x]

                    if adjacent_node.status == self.context['STATUS']['EMPTY']:
                        adjacent_node.status = self.context['STATUS']['ON']
                        self.tempChilds.append(adjacent_node)
                    # print(f'adjacent: val, state : {adjacent_node.x},{adjacent_node.y}/{adjacent_node.value},{adjacent_node.status}')
                self.context['lastClickedNode'] = self
                for tc in self.tempChilds:
                   tc.status_Changed()
                return
            if self.status == self.context['STATUS']['ON']:
                # print(f'On is clicked (x,y):{self.x},{self.y}')
                self.context['cnt_empty'] -= 1
                self.value = val
                # print(f'new val:{self.value}')
                self.status = self.context['STATUS']['OFF']
                self.context['lastClickedNode'].child.append(self)
                self.parent = self.context['lastClickedNode']
                self.context['lastClickedNode'] = None
                node_changed = []
                for tc in self.parent.tempChilds:
                    if tc.status==self.context['STATUS']['ON']:
                        tc.status = self.context['STATUS']['EMPTY']
                        node_changed.append(tc)
                node_changed.append(self)
                node_changed.append(self.parent)
                for node in node_changed:
                   node.status_Changed()