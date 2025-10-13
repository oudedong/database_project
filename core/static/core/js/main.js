import { getCookie } from "../../../../static/js/common.js";

class Node{
        static max = 1;
        static N = undefined;
        static cnt_empty = undefined;
        static lastClickedNode = undefined;
        static STATUS= {
            EMPTY: 0, //값도 없도 할당도 불가.
            OFF  : 1, //값을 가지고 있고 주변에 EMPTY인 노드를 가짐
            ON   : 2, //값을 가지고 있지않지만 할당가능한 노드
        };
        static adjacent = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
        constructor(x, y, map, div, value=undefined, parent=undefined){
            this.x = x;
            this.y = y;
            this.map = map;
            this.value  = value;
            this.child  = [];
            this.tempChilds =[];
            this.parent = parent;
            this.status = Node.STATUS.EMPTY;
            this.div = div
            this.child_lines = [];
            if(value){
                this.status = Node.STATUS.OFF;
            }
        }
        reset(){
            if(this.status != Node.STATUS.EMPTY){//차있던 타일을 제거시
                Node.cnt_empty += 1;
                //console.log('after disconnect, cnt_empty',Node.cnt_empty)
            }
            this.parent = undefined;
            this.status = Node.STATUS.EMPTY;
            this.value = undefined;
        }
        clear_line(){
            for(let i = 0; i <this.child_lines.length; i++){
                this.child_lines[i].remove();
            }
            this.child_lines = []
        }
        status_Changed(){
            if((this.value != undefined) && (this.value > Node.max)){
                Node.max = this.value;
                console.log('max_changed..:',Node.max)
            }
            document.dispatchEvent(new CustomEvent('block:status_Changed', {
                    detail:{node:this}
            }));
            if(this.child.length === 0 && (this.parent != undefined)){
                this.parent.checkChilds();
            }
        }
        round_end(){
            document.dispatchEvent(new CustomEvent('round_end'));//라운드 종료시...
        }
        checkChilds(){
            /*
            자식중에 값이 같은 노드가 있음:
                자식이 자식을 가짐->무시
                자식이 없음 -> 합침
            자식들의 합이 같음:
                아무 자식이 자식을 가짐->무시
                모든 자식이 자식이 없음 -> 합침
            */
            let sum = 0;
            let node_changed = [];
            let possibles = [];
            const permutation = (nodes, acc, cur, target, nodes_rets)=>{

                // console.log('bfs################');
                // console.log('acc:', acc);
                // console.log('cur:', cur);
                // console.log('target:', target);
                // console.log('bfs_end################');

                if(acc === target)
                    return true;
                if(cur >= nodes.length)
                    return false;
                if(acc > target)
                    return false;

                let visit = false;

                nodes_rets.push(nodes[cur]);
                visit = permutation(nodes, acc+nodes[cur].value, cur+1, target, nodes_rets)
                if(visit)return true;
                nodes_rets.pop();
                visit = permutation(nodes, acc, cur+1, target, nodes_rets)
                return visit;
            }

            for(let i=0; i < this.child.length; i++){
                if(this.child[i].child.length !== 0)
                    continue;
                possibles.push(this.child[i]);
            }

            if(permutation(possibles, 0, 0, this.value, node_changed)){

                // console.log('bfs success... node_changed:', node_changed);

                this.value *= 2;

                for(let i=0; i < node_changed.length; i++)
                    node_changed[i].reset();
                let temp = [];
                for(let i=0; i < this.child.length; i++){
                    if(this.child[i].status===Node.STATUS.EMPTY)
                        continue;
                    temp.push(this.child[i]);
                }
                this.child = temp;

                node_changed.push(this);
                for(let i = 0; i < node_changed.length; i++){
                   node_changed[i].status_Changed();
                }
            }
        }
        unset_on_titles(){ //이전 활성화 초기화
            if(Node.lastClickedNode){
                let node_changed = [];
                for(let i=0; i < Node.lastClickedNode.tempChilds.length; i++){
                    if(Node.lastClickedNode.tempChilds[i].status===Node.STATUS.ON){
                        Node.lastClickedNode.tempChilds[i].status = Node.STATUS.EMPTY;
                        node_changed.push(Node.lastClickedNode.tempChilds[i]);
                    }
                }
                for(let i = 0; i < node_changed.length; i++){
                    node_changed[i].status_Changed();
                }   
            }
        }
        clicked(val){
            if(this.status === Node.STATUS.EMPTY){
                // console.log('invalid_node...');
                return;
            }
            if(this.value === val){
                actions.push({x_from:-1, y_from:-1,x_dest:this.x, y_dest:this.y, val:curVal});
                this.unset_on_titles();
                this.value += val;
                this.status_Changed();
                this.round_end();
                return;
            }
            if(this.status === Node.STATUS.OFF){
                this.unset_on_titles();
                this.tempChilds = []; //배열 초기화
                for(let i=0; i < 8; i++){
                    const cur = Node.adjacent[i]
                    const cur_x = this.x + cur[0];
                    const cur_y = this.y + cur[1];
                    if(cur_x < 0 || cur_x >= Node.N || cur_y < 0 || cur_y >= Node.N) continue;

                    const adjacent_node = this.map[cur_y][cur_x]
                    if(adjacent_node.status === Node.STATUS.EMPTY){
                        adjacent_node.status = Node.STATUS.ON;
                        this.tempChilds.push(adjacent_node);
                    }
                }
                Node.lastClickedNode = this;//마지막으로 활성화 한 노드
                for(let i = 0; i < this.tempChilds.length; i++){
                   this.tempChilds[i].status_Changed();
                }
                return;
            }
            if(this.status === Node.STATUS.ON){
                actions.push({x_from:Node.lastClickedNode.x, y_from:Node.lastClickedNode.y,x_dest:this.x, y_dest:this.y, val:curVal});
                Node.cnt_empty -= 1;//노드한칸 차지...
                // console.log('after connect, cnt_empty',Node.cnt_empty)
                this.value = val;
                this.status = Node.STATUS.OFF;
                Node.lastClickedNode.child.push(this);
                this.parent = Node.lastClickedNode;
                Node.lastClickedNode = undefined;
                const node_changed = [];
                for(let i=0; i < this.parent.tempChilds.length; i++){
                    if(this.parent.tempChilds[i].status===Node.STATUS.ON){
                        this.parent.tempChilds[i].status = Node.STATUS.EMPTY;
                        node_changed.push(this.parent.tempChilds[i]);
                    }
                }
                node_changed.push(this);
                node_changed.push(this.parent);
                for(let i = 0; i < node_changed.length; i++){
                   node_changed[i].status_Changed();
                }
                this.round_end()
            }
        }
        update_tile(){
            this.div.textContent = this.value;
            if(this.status === Node.STATUS.ON)//색칠
                this.div.style.background = '#2ecc71';
            else if(this.status === Node.STATUS.OFF)
                this.div.style.background = '#f2f2f2';
            else if(this.status === Node.STATUS.EMPTY)
                this.div.style.background = '#7f8c8d';
        }
    }
    class Rng {
        constructor(seed){
            this.a = (seed >>> 0);                // 내부 상태
        }
        random(){
            this.a = (this.a + 0x6D2B79F5) >>> 0; // ← 오직 이 한 줄로 상태 갱신
            let t = this.a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
    }

    let user = await fetch('/accounts/check_api/'); 
    user = await user.json(); 
    user = user.user;
    const userId = user==null ? null : user.id;

    const seed = Math.floor(Math.random()*1000000);

    const board = document.querySelector('#board');
    const score = document.querySelector('#score');
    const time = document.querySelector('#time');
    const submit = document.querySelector('#submit');
    const restart = document.querySelector('#restart');
    const wires = document.querySelector('#wires');
    const next = document.querySelector('#next');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead'); // 이 ID로 화살촉을 참조합니다.
    marker.setAttribute('viewBox', '0 0 10 7');
    marker.setAttribute('markerWidth', '5'); // 마커의 너비
    marker.setAttribute('markerHeight', '5'); // 마커의 높이
    marker.setAttribute('refX', '10'); // 선의 끝점이 마커의 어느 x좌표에 맞닿을지
    marker.setAttribute('refY', '3.5'); // 선의 끝점이 마커의 어느 y좌표에 맞닿을지
    marker.setAttribute('orient', 'auto'); // 선의 기울기에 따라 화살촉이 자동으로 회전

    // 3. 화살촉 모양 생성 (<polygon> 또는 <path> 사용)
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7'); // 삼각형 모양 정의, 배열과 비슷한(x,y)꼴
    polygon.setAttribute('fill', 'context-stroke');

    // 4. 생성한 요소들을 조립
    marker.appendChild(polygon);
    defs.appendChild(marker);
    wires.appendChild(defs);


    function initTiles(N){

        const board_height = document.documentElement.clientHeight/2;
        const board_width = board_height;
        const board_gap = board_height/100;
        const board_padding = board_height/100;

        const tile_height = (board_height - board_gap*(N-1) - 2*board_padding)/N;
        const tile_width = (board_width - board_gap*(N-1) - 2*board_padding)/N;
        const tile_fontsize = tile_width / 10;
        const tile_borderRadius = tile_width / 10;

        board.style.height = `${board_height}px`;
        board.style.width = `${board_width}px`;
        board.style.gap = `${board_gap}px`;
        board.style.padding = `${board_padding}px`;
        board.style.gridTemplateColumns = `repeat(${N},1fr)`;
        board.style.gridTemplateRows = `repeat(${N},1fr)`;

        wires.style.height = `${board_height}px`;
        wires.style.width = `${board_width}px`;

        Node.cnt_empty = N*N-1;
        Node.N = N;

        let tiles = [];
        for(let i=0; i < N; i++){
            tiles.push([]);
            for(let j=0; j < N; j++){

                let div = document.createElement('div');
                let temp_node = new Node(j,i,tiles,div)

                tiles[i].push(temp_node);        
                div.style.height   = tile_height;
                div.style.width    = tile_width;
                div.style.fontSize = tile_fontsize;
                div.style.borderRadius = tile_borderRadius;
                div.className = 'tile';
                div.textContent = temp_node.value;
                div.addEventListener('click',(e)=>{
                    temp_node.clicked(curVal);
                })

                board.appendChild(div);
                temp_node.update_tile();
            }
        }
        tiles[0][0].value = 1;
        tiles[0][0].status = Node.STATUS.OFF;
        tiles[0][0].update_tile();
        return tiles;
    }

    restart.addEventListener('click',(e)=>{
        location.reload();
    })
    if (submit){
        submit.addEventListener('click', async ()=>{
            const data = {
                userId: userId,
                score : Node.max,
                time  : time_len,
                actions : actions,
                seed : seed
            };
            try {
                const response = await fetch('/submit',{                
                    method:'POST',
                    headers : {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body  : JSON.stringify(data),
                });
                if(response.ok){
                    alert('submit success!')
                    submit.disabled = true;
                }
                else{
                    m = await response.text();
                    alert(`submit failed:${m}`);
                }
            } catch (error) {
                alert(`server not response...`)
            }
        });
    }

    function centerOfCell(node){
        
        const cr = node.div.getBoundingClientRect();
        const br = board.getBoundingClientRect();

        return { x: cr.left - br.left + cr.width/2,
                 y: cr.top  - br.top  + cr.height/2 };
    }
    function drawline(node_from, node_to){
        
        const node_from_pos = centerOfCell(node_from);
        const node_to_pos = centerOfCell(node_to);
        const ln = document.createElementNS('http://www.w3.org/2000/svg','line');
        
        //살짝 중앙에서 밀려나게
        const x_diff = node_to_pos.x - node_from_pos.x;
        const y_diff = node_to_pos.y - node_from_pos.y;
        const ratio = 0.2;

        node_from_pos.x += x_diff*ratio;
        node_from_pos.y += y_diff*ratio;
        node_to_pos.x -= x_diff*ratio;
        node_to_pos.y -= y_diff*ratio;

        // console.log(node_from_pos);
        // console.log(node_to_pos);

        ln.setAttribute('x1', node_from_pos.x);
        ln.setAttribute('y1', node_from_pos.y);
        ln.setAttribute('x2', node_to_pos.x);
        ln.setAttribute('y2', node_to_pos.y);
        ln.setAttribute('marker-end', 'url(#arrowhead)');
        wires.appendChild(ln);
        node_from.child_lines.push(ln);
    }
    document.addEventListener('block:status_Changed',(e)=>{

        const node = e.detail.node;

        // console.log('block_event=======================');
        // console.log(node);

        
        // 타일 업데이트&선연결
        node.update_tile()
        node.clear_line()//기존연결 제거 후 재연결
        for(let i = 0; i < node.child.length; i++){
            // console.log('adding wires...');
            drawline(node, node.child[i]);
        }
        // console.log('block_event End=======================');
    })
    document.addEventListener('round_end',(e)=>{

        console.log('round_end=======================');
        
        let rand = rng.random();
        // console.log("rand(0~1):",rand);
        // console.log("curval:",curVal); 
        curVal = Math.floor(rand*Math.floor(Node.max/2))+1
        console.log("Node.max:",Node.max);
        console.log("nextVal:",curVal); 

        score.textContent = Node.max;
        next.textContent = curVal;
        if(Node.cnt_empty === 0){
            if(submit)
                submit.disabled = false;
            clearInterval(timer);
            alert('game over');
        }
        console.log('round_end End=======================');
    })

    const rng = new Rng(seed);
    let tiles, time_start = null, time_len = null, timer = null;
    let curVal = Math.floor(rng.random()*Math.floor(Node.max/2))+1;
    const actions = [];

    tiles = initTiles(5);
    time_start = Date.now();
    timer = setInterval(()=>{
        time_len = Math.floor((Date.now()-time_start)/1000);
        time.textContent = time_len;
    }, 1000)