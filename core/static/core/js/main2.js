import { getCookie } from "../../../../static/js/common.js";

class Node_v2{

    static STATUS= {
        EMPTY: 0, //비활성화+값없음.
        OFF  : 1, //비활성화+값있음
        ON   : 2, //활성화+값없음
    };

   constructor(div, value=undefined, parent=undefined){
        this.value  = value;
        this.childs  = [];
        this.parent = parent;
        this.div = div
        if(value){
            this.status = Node_v2.STATUS.OFF;
        } else{
            this.status = Node_v2.STATUS.EMPTY;
        }
    }
    append_child(node){
        this.childs.push(node);
        node.parent = this;
    }
    merge_with_childs(){
        
        let possibles = [];
        for(let i = 0; i < this.childs.length; i++){
            if(this.childs[i].childs.length <= 0){
                possibles.push(this.childs[i]);
            }
        }

        const permutation = (possibles, accumulate, cur_index, target_sum, found_nodes)=>{
            if(accumulate === target_sum)
                return true;
            if(cur_index >= possibles.length)
                return false;
            if(accumulate > target_sum)
                return false;

            let result = false;

            found_nodes.push(possibles[cur_index]);
            result = permutation(possibles, accumulate+possibles[cur_index].value, cur_index+1, target_sum, found_nodes)
            if(result)return true;
            found_nodes.pop();
            result = permutation(possibles, accumulate, cur_index+1, target_sum, found_nodes)
            return result;
        }

        let max_value = 0;
        let found_nodes = [];
        let result = permutation(possibles, 0, 0, this.value, found_nodes);
        if(!result) return; //실패
        this.value *= 2;
        this.div.textContent = this.value;
        if(this.value > max_value)
            max_value = this.value;
        for(let i = 0; i < found_nodes.length; i++){
            found_nodes[i].reset_node();
        }
        
        let new_childs = [];
        for(let i = 0; i < this.childs.length; i++){
            if(this.childs[i].status != Node_v2.STATUS.EMPTY){
                new_childs.push(this.childs[i]);
            }
        }
        this.childs = new_childs;
        
        result = {
            max_value: max_value,
            cnt_merge: found_nodes.length
        };

        if(this.parent != undefined){
            let temp = this.parent.merge_with_childs();
            console.log('parents_merge_ret:',temp);
            if(temp != undefined){
                console.log('gathered');
                result.max_value = Math.max(result.max_value, temp.max_value);
                result.cnt_merge += temp.cnt_merge;
            }
        }
        console.log('my_merge_ret:',result);
        return result;
    }
    reset_node(){
        this.value = undefined;
        this.status = Node_v2.STATUS.EMPTY;
        this.div.textContent = this.value;
        this.div.style.background = '#7f8c8d';
        this.parent = undefined;
    }
    on_node(){
        if(this.status!=Node_v2.STATUS.EMPTY){
            throw Error('tried to turn on none empty node...');
        }
        this.status = Node_v2.STATUS.ON;
        this.div.style.background = '#2ecc71';
    }
    off_node(){
        if(this.status!=Node_v2.STATUS.ON){
            throw Error('tried to turn off none on node...');
        }
        if(this.value != undefined){
            this.status = Node_v2.STATUS.OFF;
            this.div.style.background = '#f2f2f2';
        }
        else{
            this.reset_node();
        }
    }
    activate_node(value){
        if(this.status!=Node_v2.STATUS.ON){
            throw Error('tried to activate none on node...');
        }
        this.status = Node_v2.STATUS.OFF;
        this.value = value
        this.div.textContent = value;
        this.div.style.background = '#f2f2f2';
    }
    add_value(value){
        if(this.status == Node_v2.STATUS.EMPTY || this.value != value){
            throw Error('no add');
        }
        this.value += value;
        this.div.textContent = this.value;
    }
}
class Board{

    static adjacent = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];

    constructor(controller, element_board, element_wires, board_size){

        this.controller = controller;
        this.cur_value = 1;
        this.element_wires = element_wires;
        this.element_board = element_board;
        this.max_value = 1;
        this.board_size = board_size;
        this.cnt_empty = board_size*board_size-1;
        this.temp_context = {
            last_clicked_x: undefined,
            last_clicked_y: undefined,
            last_clicked_node: undefined,
            temp_nodes  : []
        };
        this.nodes = [];

        const board_height = document.documentElement.clientHeight/2;
        const board_width = board_height;
        const board_gap = board_height/100;
        const board_padding = board_height/100;
        this.element_board.style.height = `${board_height}px`;
        this.element_board.style.width = `${board_width}px`;
        this.element_board.style.gap = `${board_gap}px`;
        this.element_board.style.padding = `${board_padding}px`;
        this.element_board.style.gridTemplateColumns = `repeat(${this.board_size},1fr)`;
        this.element_board.style.gridTemplateRows = `repeat(${this.board_size},1fr)`;

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
        this.element_wires.appendChild(defs);
        this.element_wires.style.height = `${board_height}px`;
        this.element_wires.style.width = `${board_width}px`;

        this.edges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.edges.setAttribute('id','edges');
        this.edges.style.height = `${board_height}px`;
        this.edges.style.width = `${board_width}px`;
        this.element_wires.appendChild(this.edges);


        const tile_height = (board_height - board_gap*(this.board_size-1) - 2*board_padding)/this.board_size;
        const tile_width = (board_width - board_gap*(this.board_size-1) - 2*board_padding)/this.board_size;
        const tile_fontsize = tile_width / 10;
        const tile_borderRadius = tile_width / 10;
        for(let i=0; i < board_size; i++){
            this.nodes.push([]);
            for(let j=0; j < board_size; j++){

                let div = document.createElement('div');
                div.style.height   = tile_height;
                div.style.width    = tile_width;
                div.style.fontSize = tile_fontsize;
                div.style.borderRadius = tile_borderRadius;
                div.className = 'tile';
                div.addEventListener('click',(e)=>{
                    this.clicked(j, i);
                })
                this.element_board.appendChild(div);

                let temp_node = new Node_v2(div);
                temp_node.reset_node();

                this.nodes[i].push(temp_node);
            }
        }
        this.nodes[0][0].on_node();
        this.nodes[0][0].activate_node(1);
    }
    clicked(x,y){

        const clicked_node = this.nodes[y][x];

        const postprocess = ()=>{

            const element_board = this.element_board;
            const edges = this.edges;
            let merge_result = undefined;

            if(clicked_node.parent != undefined){
                merge_result = clicked_node.parent.merge_with_childs();
            }
            if(merge_result != undefined){
                this.cnt_empty += merge_result.cnt_merge;
                this.max_value = Math.max(this.max_value, merge_result.max_value);
                console.log('merge_result:',merge_result);
            }

            function centerOfCell(node){
        
                const cr = node.div.getBoundingClientRect();
                const br = element_board.getBoundingClientRect();

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
                
                ln.setAttribute('stroke', 'orange');
                ln.setAttribute('stroke-width', '2');
                ln.setAttribute('x1', node_from_pos.x);
                ln.setAttribute('y1', node_from_pos.y);
                ln.setAttribute('x2', node_to_pos.x);
                ln.setAttribute('y2', node_to_pos.y);
                ln.setAttribute('marker-end', 'url(#arrowhead)');
                edges.appendChild(ln);
            }
            while (edges.firstChild) edges.removeChild(edges.firstChild);
            for(let i = 0; i < this.board_size; i++){
                for(let j = 0; j < this.board_size; j++){
                    const st_node = this.nodes[i][j];
                    for(let k = 0; k < st_node.childs.length; k++){
                        const dest_node = st_node.childs[k];
                        drawline(st_node, dest_node);
                    }
                }
            }
        };
        const go_next_round = (x_from, y_from, x_dest, y_dest, cur_value) =>{
            const context_to_controller = {
                action:{x_from:x_from, y_from:y_from,x_dest:x_dest, y_dest:y_dest, val:cur_value, max_value:this.max_value},
                max_value:this.max_value,
                cnt_empty:this.cnt_empty
            };
            this.controller.go_next_round(context_to_controller);
        };
        const reset_temp_context = ()=>{
            for(let i=0; i < this.temp_context.temp_nodes.length; i++){
                if(this.temp_context.temp_nodes[i].status === Node_v2.STATUS.ON)
                    this.temp_context.temp_nodes[i].off_node();
            }
            this.temp_context.temp_nodes = [];
            this.temp_context.last_clicked_node = undefined;
            this.temp_context.last_clicked_x = undefined;
            this.temp_context.last_clicked_y = undefined;
        }

        console.log('at_Board=====================');
        console.log('clicked_node_value',clicked_node.value);
        console.log('clicked_node_status',clicked_node.status);
        console.log('node_V2_statuses:',Node_v2.STATUS.EMPTY,Node_v2.STATUS.OFF,Node_v2.STATUS.ON);
        console.log('board.cur_value',this.cur_value);

        if(clicked_node.status === Node_v2.STATUS.EMPTY){
            console.log('clicked_0');
            return;
        }
        if(clicked_node.value == this.cur_value){
            console.log('clicked_1');
            clicked_node.add_value(this.cur_value);
            reset_temp_context();
            postprocess();
            go_next_round(-1, -1, x, y, this.cur_value);
            return;
        }
        if(clicked_node.status === Node_v2.STATUS.OFF){
            console.log('clicked_2');
            reset_temp_context();
            this.temp_context.last_clicked_x = x;//마지막으로 활성화 한 노드
            this.temp_context.last_clicked_y = y;
            this.temp_context.last_clicked_node = clicked_node;
            for(let i=0; i < 8; i++){

                const cur = Board.adjacent[i]
                const cur_x = x + cur[0];
                const cur_y = y + cur[1];

                if(cur_x < 0 || cur_x >= this.board_size || cur_y < 0 || cur_y >= this.board_size) continue;
                console.log('adjacent');
                console.log('x:',cur_x);
                console.log('y:',cur_y);
                const adjacent_node = this.nodes[cur_y][cur_x]
                if(adjacent_node.status === Node_v2.STATUS.EMPTY){
                    adjacent_node.on_node();
                    this.temp_context.temp_nodes.push(adjacent_node);
                }
            }
            return;
        }
        if(clicked_node.status === Node_v2.STATUS.ON){
            console.log('clicked_3');
            this.cnt_empty -= 1;//노드한칸 차지...
            clicked_node.activate_node(this.cur_value);
            this.temp_context.last_clicked_node.append_child(clicked_node);
            this.temp_context.last_clicked_node = undefined;

            const last_clicked_x = this.temp_context.last_clicked_x;
            const last_clicked_y = this.temp_context.last_clicked_y;
            reset_temp_context();
            postprocess()
            go_next_round(last_clicked_x,last_clicked_y, x, y, this.cur_value);
        }
    }
    update(context){
        this.cur_value = context.cur_value;
    }
}
class State_panel{
    constructor(element_score, element_time, element_value){

        this.score_view = element_score;
        this.time_view = element_time;
        this.cur_value_view = element_value;

        this.time_st = Date.now();
        this.time_len = null;
        this.timer = setInterval(()=>{
            this.time_len = Math.floor((Date.now()-this.time_st)/1000);
            this.time_view.textContent = this.time_len;
        }, 1000)
    }
    update(context){
        this.score_view.textContent = context.score;
        this.cur_value_view.textContent = context.cur_value;
    }
    end(){
        clearInterval(this.timer)
    }
    get_result(){
        return {
            time_len: this.time_len,
        }
    }
}
class Controller{
    constructor(){
        this.data = {
            userId: null,
            score : null,
            time  : null,
            actions:[],
            seed  : Math.floor(Math.random()*1000000)
        };
        this.rng = new Rng(this.data.seed);
        this.cur_value = 1;
        this.board = new Board(
            this,
            document.querySelector('#board'),
            document.querySelector('#wires'),
            5);
        this.state_panel = new State_panel(
            document.querySelector('#score'),
            document.querySelector('#time'),
            document.querySelector('#next')
        );

        this.submit_url = document.querySelector('#submit_url').textContent;
        this.login_check_url = document.querySelector('#account_check_url').textContent;

        this.submit_button = document.querySelector('#submit');
        this.restart_button = document.querySelector('#restart');
        this.restart_button.addEventListener('click',(e)=>{
            location.reload();
        })
        if (this.submit_button){
            this.submit_button.addEventListener('click', async ()=>{
                try {
                    const response = await fetch(this.submit_url,{                
                        method:'POST',
                        headers : {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken'),
                        },
                        body  : JSON.stringify(this.data),
                    });
                    if(response.ok){
                        alert('submit success!')
                        submit.disabled = true;
                    }
                    else{
                        let m = await response.text();
                        alert(`submit failed:${m}`);
                    }
                } catch (error) {
                    alert('server not response');
                }
            });
        }
    }
    async go_next_round(context){

        let score = context.max_value;
        let rand = this.rng.random();
        this.cur_value = Math.floor(rand*Math.floor(score/2))+1
        this.data.actions.push(context.action);
        // console.log("rand(0~1):",rand);
        // console.log("curval:",curVal); 
        console.log('at_controller===========');
        console.log('context:', context);
        console.log("max:",score);
        console.log("nextVal:",this.cur_value); 
        // action:
        // {x_from:x_from, y_from:y_from,x_dest:x_dest, y_dest:y_dest, val:cur_value},
        //  max_value:this.max_value,
        //  cnt_empty:this.cnt_empty}
        this.state_panel.update({score:score, cur_value:this.cur_value});
        this.board.update({cur_value:this.cur_value});
        if(context.cnt_empty <= 0){
            if(this.this.submit_button != undefined)
                this.submit_button.disabled = false;
            this.state_panel.end();
            this.data.score = score;
            this.data.time = this.state_panel.get_result().time_len; 
            let user = await fetch(this.login_check_url); 
            user = await user.json(); 
            user = user.user;
            this.data.userId = user==null ? null : user.id;
            alert('game over');
        }
    }
}
    //시드로부터 난수를 생성함
class Rng {
    constructor(seed){
        this.a = (seed >>> 0);                //내부 상태
    }
    random(){
        this.a = (this.a + 0x6D2B79F5) >>> 0; //상태 갱신
        let t = this.a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

let gogogo = new Controller();
window.gogogo = gogogo;