import { getCookie } from "../../../../static/js/common.js";

class Node_v2{

    static STATUS= {
        EMPTY: 0, //비활성화+값없음.
        OFF  : 1, //비활성화+값있음
        ON   : 2, //활성화+값없음
    };

   constructor(div, board_index, value=undefined){
        this.value  = value;
        this.neighbors = [];
        this.board_index = board_index;
        this.div = div;
        if(value){
            this.status = Node_v2.STATUS.OFF;
        } else{
            this.status = Node_v2.STATUS.EMPTY;
        }
    }
    connect(node){
        this.neighbors.push(node);
        node.neighbors.push(this);
    }
    async merge_from_leaves(on_preview=undefined, on_after_step=undefined){
        let max_value = 0;
        let cnt_merge = 0;

        while(true){
            let possibles = [];
            for(let i = 0; i < this.neighbors.length; i++){
                const nb = this.neighbors[i];
                if(nb.neighbors.length === 1 && nb.status !== Node_v2.STATUS.EMPTY){
                    possibles.push(nb);
                }
            }
            if(possibles.length === 0) break;

            const permutation = (possibles, accumulate, cur_index, target_sum, found_nodes)=>{
                if(accumulate === target_sum)
                    return true;
                if(cur_index >= possibles.length)
                    return false;
                if(accumulate > target_sum)
                    return false;

                let result = false;

                found_nodes.push(possibles[cur_index]);
                result = permutation(possibles, accumulate+possibles[cur_index].value, cur_index+1, target_sum, found_nodes);
                if(result) return true;
                found_nodes.pop();
                result = permutation(possibles, accumulate, cur_index+1, target_sum, found_nodes);
                return result;
            };

            let found_nodes = [];
            let ok = permutation(possibles, 0, 0, this.value, found_nodes);
            if(!ok) break;

            if(on_preview){
                await on_preview(this, found_nodes);
            }

            this.value *= 2;
            this._sync_visual();
            if(this.value > max_value)
                max_value = this.value;
            for(let i = 0; i < found_nodes.length; i++){
                found_nodes[i].reset_node();
            }
            cnt_merge += found_nodes.length;
            if(on_after_step){
                on_after_step();
            }
            if(this.neighbors.length <= 1) break;
        }

        if(cnt_merge === 0) return;

        let result = {
            max_value: max_value,
            cnt_merge: cnt_merge
        };

        if(this.neighbors.length === 1){
            let temp = await this.neighbors[0].merge_from_leaves(on_preview, on_after_step);
            if(temp != undefined){
                result.max_value = Math.max(result.max_value, temp.max_value);
                result.cnt_merge += temp.cnt_merge;
            }
        }
        return result;
    }
    _sync_visual(){
        if(this.status === Node_v2.STATUS.EMPTY){
            this.div.dataset.state = 'empty';
            delete this.div.dataset.tier;
            this.div.textContent = '';
        } else if(this.status === Node_v2.STATUS.ON){
            this.div.dataset.state = 'on';
            delete this.div.dataset.tier;
            this.div.textContent = '';
        } else {
            this.div.dataset.state = 'off';
            const tier = Math.min(7, Math.floor(Math.log2(this.value)));
            this.div.dataset.tier = String(tier);
            this.div.textContent = this.value;
        }
    }
    reset_node(){
        this.value = undefined;
        this.status = Node_v2.STATUS.EMPTY;
        this.div.classList.remove('tile-selected');
        this._sync_visual();
        for(let i = 0; i < this.neighbors.length; i++){
            const nb = this.neighbors[i];
            nb.neighbors = nb.neighbors.filter((x) => x !== this);
        }
        this.neighbors = [];
    }
    on_node(){
        if(this.status!=Node_v2.STATUS.EMPTY){
            throw Error('tried to turn on none empty node...');
        }
        this.status = Node_v2.STATUS.ON;
        this._sync_visual();
    }
    off_node(){
        if(this.status!=Node_v2.STATUS.ON){
            throw Error('tried to turn off none on node...');
        }
        if(this.value != undefined){
            this.status = Node_v2.STATUS.OFF;
            this._sync_visual();
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
        this.value = value;
        this._sync_visual();
    }
    add_value(value){
        if(this.status == Node_v2.STATUS.EMPTY || this.value != value){
            throw Error('no add');
        }
        this.value += value;
        this._sync_visual();
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

        this.element_board.style.gridTemplateColumns = `repeat(${this.board_size}, 1fr)`;
        this.element_board.style.gridTemplateRows = `repeat(${this.board_size}, 1fr)`;

        this.edges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.edges.setAttribute('id', 'edges');
        this.element_wires.appendChild(this.edges);

        for(let i=0; i < board_size; i++){
            this.nodes.push([]);
            for(let j=0; j < board_size; j++){
                let div = document.createElement('div');
                div.className = 'tile';
                div.addEventListener('click',(e)=>{
                    this.clicked(j, i);
                })
                this.element_board.appendChild(div);

                let temp_node = new Node_v2(div, i * board_size + j);
                temp_node.reset_node();

                this.nodes[i].push(temp_node);
            }
        }
        this.nodes[0][0].on_node();
        this.nodes[0][0].activate_node(1);
        this.is_animating = false;
        this.highlight_matches();
        window.addEventListener('resize', () => this.render_edges());
    }
    highlight_matches(){
        for(let i = 0; i < this.board_size; i++){
            for(let j = 0; j < this.board_size; j++){
                const node = this.nodes[i][j];
                const matched = (node.status === Node_v2.STATUS.OFF && node.value === this.cur_value);
                node.div.classList.toggle('tile-match', matched);
            }
        }
    }
    render_edges(){
        const element_board = this.element_board;
        const edges = this.edges;
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
            const x_diff = node_to_pos.x - node_from_pos.x;
            const y_diff = node_to_pos.y - node_from_pos.y;
            const ratio = 0.2;
            node_from_pos.x += x_diff*ratio;
            node_from_pos.y += y_diff*ratio;
            node_to_pos.x -= x_diff*ratio;
            node_to_pos.y -= y_diff*ratio;
            ln.setAttribute('x1', node_from_pos.x);
            ln.setAttribute('y1', node_from_pos.y);
            ln.setAttribute('x2', node_to_pos.x);
            ln.setAttribute('y2', node_to_pos.y);
            edges.appendChild(ln);
        }
        while (edges.firstChild) edges.removeChild(edges.firstChild);
        for(let i = 0; i < this.board_size; i++){
            for(let j = 0; j < this.board_size; j++){
                const st_node = this.nodes[i][j];
                for(let k = 0; k < st_node.neighbors.length; k++){
                    const dest_node = st_node.neighbors[k];
                    if(st_node.board_index < dest_node.board_index){
                        drawline(st_node, dest_node);
                    }
                }
            }
        }
    }
    async clicked(x,y){
        if(this.is_animating) return;

        const clicked_node = this.nodes[y][x];

        const postprocess = async ()=>{
            this.render_edges();
            const on_preview = async (target, leaves) => {
                target.div.classList.add('tile-merge-target');
                for(let i = 0; i < leaves.length; i++){
                    leaves[i].div.classList.add('tile-merge-leaf');
                }
                await new Promise((resolve) => setTimeout(resolve, 350));
                target.div.classList.remove('tile-merge-target');
                for(let i = 0; i < leaves.length; i++){
                    leaves[i].div.classList.remove('tile-merge-leaf');
                }
            };
            const on_after_step = () => {
                this.render_edges();
            };

            let merge_result = undefined;
            if(clicked_node.neighbors.length === 1){
                merge_result = await clicked_node.neighbors[0].merge_from_leaves(on_preview, on_after_step);
            }
            else if(clicked_node.neighbors.length > 1){
                merge_result = await clicked_node.merge_from_leaves(on_preview, on_after_step);
            }
            if(merge_result != undefined){
                this.cnt_empty += merge_result.cnt_merge;
                this.max_value = Math.max(this.max_value, merge_result.max_value);
                console.log('merge_result:',merge_result);
            }
            this.render_edges();
        };
        const go_next_round = async (x_from, y_from, x_dest, y_dest, cur_value) =>{
            const context_to_controller = {
                action:{x_from:x_from, y_from:y_from,x_dest:x_dest, y_dest:y_dest, val:cur_value, max_value:this.max_value},
                max_value:this.max_value,
                cnt_empty:this.cnt_empty
            };
            await this.controller.go_next_round(context_to_controller);
        };
        const reset_temp_context = ()=>{
            if(this.temp_context.last_clicked_node){
                this.temp_context.last_clicked_node.div.classList.remove('tile-selected');
            }
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
            this.is_animating = true;
            try {
                clicked_node.add_value(this.cur_value);
                this.max_value = Math.max(this.max_value, clicked_node.value);
                reset_temp_context();
                await postprocess();
                await go_next_round(-1, -1, x, y, this.cur_value);
            } finally {
                this.is_animating = false;
            }
            return;
        }
        if(clicked_node.status === Node_v2.STATUS.OFF){
            console.log('clicked_2');
            reset_temp_context();
            this.temp_context.last_clicked_x = x;//마지막으로 활성화 한 노드
            this.temp_context.last_clicked_y = y;
            this.temp_context.last_clicked_node = clicked_node;
            clicked_node.div.classList.add('tile-selected');
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
            this.is_animating = true;
            try {
                this.cnt_empty -= 1;//노드한칸 차지...
                const last_clicked_x = this.temp_context.last_clicked_x;
                const last_clicked_y = this.temp_context.last_clicked_y;
                clicked_node.activate_node(this.cur_value);
                this.temp_context.last_clicked_node.connect(clicked_node);
                reset_temp_context();
                await postprocess();
                await go_next_round(last_clicked_x,last_clicked_y, x, y, this.cur_value);
            } finally {
                this.is_animating = false;
            }
        }
    }
    update(context){
        this.cur_value = context.cur_value;
        this.highlight_matches();
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
            session_id: null,
            nickname: '',
            score : null,
            actions:[],
        };
        this.rng = new Rng(Math.floor(Math.random()*1000000));
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

        this.start_url = document.querySelector('#start_url')?.textContent;
        this.submit_url = document.querySelector('#submit_url').textContent;
        this.login_check_url = document.querySelector('#account_check_url').textContent;

        this.submit_button = document.querySelector('#submit');
        this.nickname_input = document.querySelector('#nickname');
        this.restart_button = document.querySelector('#restart');
        this.restart_button.addEventListener('click',(e)=>{
            location.reload();
        })
        this.session_promise = null;
        if (this.start_url){
            this.session_promise = this.start_session();
        }
        if (this.submit_button){
            this.submit_button.addEventListener('click', async ()=>{
                const nickname = (this.nickname_input?.value || '').trim();
                if (!nickname || nickname.length > 20) {
                    this.show_alert('닉네임을 1~20자로 입력해 주세요.', 'warning');
                    this.nickname_input?.focus();
                    return;
                }
                this.data.nickname = nickname;
                try {
                    if (this.session_promise) {
                        await this.session_promise;
                    }
                    const response = await fetch(this.submit_url,{                
                        method:'POST',
                        headers : {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken'),
                        },
                        body  : JSON.stringify(this.data),
                    });
                    if(response.ok){
                        this.show_alert('점수가 성공적으로 제출되었습니다!', 'success');
                        this.submit_button.disabled = true;
                    }
                    else{
                        let m = await response.json();
                        this.show_alert(`제출 실패: ${m.error}`, 'danger');
                    }
                } catch (error) {
                    this.show_alert('서버가 응답하지 않습니다.', 'danger');
                }
            });
        }
    }
    show_alert(message, variant='info'){
        const box = document.querySelector('#game-alert');
        if(!box) return;
        box.className = `alert alert-${variant} mb-0 w-100 text-center fw-semibold`;
        box.textContent = message;
    }
    async start_session(){
        try {
            const response = await fetch(this.start_url, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
            });
            if (response.ok) {
                const payload = await response.json();
                this.data.session_id = payload.data.session_id;
                this.rng = new Rng(payload.data.seed);
            }
        } catch (error) {
            console.error('failed to start game session:', error);
        }
    }
    async go_next_round(context){
        if (this.session_promise) {
            await this.session_promise;
            this.session_promise = null;
        }

        let score = context.max_value;
        let rand = this.rng.random();
        if (score < 2) {
            this.cur_value = 1;
        } else {
            const k_max = Math.floor(Math.log2(Math.floor(score / 2)));
            const exp = Math.floor(rand * (k_max + 1));
            this.cur_value = 1 << exp;
        }
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
            if(this.submit_button != undefined)
                this.submit_button.disabled = false;
            this.state_panel.end();
            this.data.score = score;
            this.show_alert(`게임 종료! 최종 점수: ${score}점`, 'warning');
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