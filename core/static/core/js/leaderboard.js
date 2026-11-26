import { t } from './i18n.js?v=20261126';

const learderBoard = document.querySelector('#leaderboard');
const leaderboard_api_url = document.querySelector('#leaderboard_api_url').textContent;

class Category_tabs{

    static tab_elements = [];
    static details = [];
    static curTab = 0;

    static add_tab(ele, detail){
        
        Category_tabs.tab_elements.push(ele);
        Category_tabs.details.push(detail);

        const i = Category_tabs.tab_elements.length - 1;

        ele.addEventListener('click', (e)=>{
            e.preventDefault();

            document.dispatchEvent(
                new CustomEvent(
                    'click:Category_tabs', 
                    {detail:{detail:Category_tabs.details[i]}}
                ));
            Category_tabs.curTab = i;
            Category_tabs.update();
        });
    }
    static update(){
        for(let i = 0; i < Category_tabs.tab_elements.length; i++){
            if(i != Category_tabs.curTab){
                Category_tabs.tab_elements[i].classList.remove('active');
                continue;
            }
            Category_tabs.tab_elements[i].classList.add('active');
        }
    }
    static get_detail(i){
        return Category_tabs.details[i];
    }
};
class Leaderboard{

    static board = document.querySelector('#leaderboard');

    constructor(list,page_num,page_size){
        Leaderboard.lastState = { list, page_num, page_size };
        Leaderboard.board.innerHTML = '';
        if (!list || list.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'list-group-item text-center text-muted py-4';
            empty.textContent = t('lb.empty');
            Leaderboard.board.appendChild(empty);
            return;
        }
        for(let i = 0; i < list.length; i++){
            const rank = i + 1 + (page_num - 1) * page_size;
            const li = document.createElement('li');
            li.className = 'list-group-item leaderboard-row';

            const left = document.createElement('div');
            left.className = 'd-flex align-items-center gap-3';

            const badge = document.createElement('span');
            badge.className = 'rank-badge';
            badge.textContent = rank;

            const info = document.createElement('div');
            const nameEl = document.createElement('div');
            nameEl.className = 'fw-bold';
            nameEl.textContent = list[i].username;

            const dateEl = document.createElement('div');
            dateEl.className = 'small text-muted';
            dateEl.textContent = list[i].date;

            info.appendChild(nameEl);
            info.appendChild(dateEl);
            left.appendChild(badge);
            left.appendChild(info);

            const right = document.createElement('div');
            right.className = 'text-end';

            const scoreEl = document.createElement('div');
            scoreEl.className = 'fw-bold fs-5 text-success';
            scoreEl.textContent = t('lb.scoreUnit', { score: list[i].score });

            const timeEl = document.createElement('div');
            timeEl.className = 'small text-muted';
            timeEl.textContent = t('lb.timeUnit', { time: list[i].time });

            right.appendChild(scoreEl);
            right.appendChild(timeEl);

            li.appendChild(left);
            li.appendChild(right);

            if(page_num == 1 && i < 3){
                li.classList.add(`rank-${i+1}`);
            }
            Leaderboard.board.appendChild(li);
        }
    }

}
class Page_tabs{

    static button_prev = document.querySelector('#prev');
    static button_next = document.querySelector('#next');
    static page_buttons = document.querySelector('#pages');
    static curPage = 1

    constructor(page_info){

        Page_tabs.page_buttons.innerHTML = '';
        Page_tabs.curPage = page_info.curPage;

        Page_tabs.button_prev.addEventListener('click',(e)=>{

            e.preventDefault()

            if(Page_tabs.curPage > 1){
                Page_tabs.curPage -= 1;
                document.dispatchEvent(new CustomEvent('click:page_tab', {detail:{curPage:Page_tabs.curPage}}))
            }
            else return;
        })
        Page_tabs.button_next.addEventListener('click',(e)=>{

            e.preventDefault()

            if(Page_tabs.curPage < page_info.num_pages){
                Page_tabs.curPage += 1;
                document.dispatchEvent(new CustomEvent('click:page_tab', {detail:{curPage:Page_tabs.curPage}}))
            }
            else return;
        })

        let left = Page_tabs.curPage;
        let right = Page_tabs.curPage;
        let total = 5;

        while(total > 0){

            let flag = false;

            if(left-1 > 0){
                left -= 1;
                total -= 1;
                flag = true;
            }
            if(right+1 <= page_info.num_pages){
                right += 1;
                total -= 1;
                flag = true;
            }
            if(!flag){
                break;
            }
        }
        console.log(left);
        console.log(right);
        console.log(total);
        if(left < Page_tabs.curPage)
            Page_tabs.button_prev.classList.remove('disabled');
        else
            Page_tabs.button_prev.classList.add('disabled');
        if(right > Page_tabs.curPage)
            Page_tabs.button_next.classList.remove('disabled');
        else
            Page_tabs.button_next.classList.add('disabled');
        
        for(let i = left; i <= right; i++){

            let page_button = document.createElement('li');
            page_button.classList.add('page-item');
            if(i == Page_tabs.curPage){
                page_button.classList.add('active');
            }

            let page_button_inner = document.createElement('a');
            page_button_inner.classList.add('page-link');
            page_button_inner.textContent = `${i}`;
            page_button_inner.addEventListener('click',(e)=>{
                e.preventDefault()
                document.dispatchEvent(new CustomEvent('click:page_tab', {detail:{curPage:Number(page_button_inner.textContent)}}))
            })

            page_button.appendChild(page_button_inner);
            Page_tabs.page_buttons.appendChild(page_button);
        }
    }
}


async function get_page(page, detail, page_size=10){

    let url = leaderboard_api_url+`?page=${page}&page_size=${page_size}`;
    let params = Object.entries(detail);
    for(let i = 0; i < params.length; i++){
        url += `&${params[i][0]}=${params[i][1]}`;
    }
    console.log(url);
    const response = await fetch(url);
    if(!response.ok){
        let err = await response.json();
        alert(t('lb.loadFailed', { error: err.error }));
        return { scores: [], page_info: { prev: false, next: false, curPage: 1, num_pages: 1 } };
    }
    const payload = await response.json();
    return payload.data;
}
function dateToYMDString(date){
    console.log('at dateToYMDString:',date);
    let ret = '';
    ret += date.getFullYear();
    ret += String(date.getMonth()+1).padStart(2,'0');
    ret += String(date.getDate()).padStart(2,'0');
    return ret;
}
function parse_detail(detail){
    let result = {}
    if(detail.type == 'date_rank'){
        if(detail.time_diff!=undefined){
            let date_st = new Date();
            date_st.setDate(date_st.getDate() + detail.time_diff);
            result.range = dateToYMDString(date_st)+'~'+dateToYMDString(new Date());
        }
    }
    result.type = detail.type;
    return result;
}
document.addEventListener('click:Category_tabs',async (e)=>{
    const detail = parse_detail(e.detail.detail);
    let response = await get_page(1, detail, 10);
    new Leaderboard(response.scores,1,10);
    new Page_tabs(response.page_info);
})
document.addEventListener('click:page_tab',async (e)=>{

    const detail = parse_detail(Category_tabs.get_detail(Category_tabs.curTab));
    let curPage = e.detail.curPage;
    let response = await get_page(curPage, detail, 10);
    new Leaderboard(response.scores,curPage,10);
    new Page_tabs(response.page_info);
})

Category_tabs.add_tab(document.querySelector('#rank_total'), {type:'date_rank',time_diff:null});
Category_tabs.add_tab(document.querySelector('#rank_weekly'), {type:'date_rank',time_diff:-7});
Category_tabs.add_tab(document.querySelector('#rank_month'), {type:'date_rank',time_diff:-31});
Category_tabs.add_tab(document.querySelector('#rank_user'), {type:'user_rank'});

document.addEventListener('tp:langchange', () => {
    if (Leaderboard.lastState) {
        const { list, page_num, page_size } = Leaderboard.lastState;
        new Leaderboard(list, page_num, page_size);
    }
});

let temp = await get_page(1,{type:'date_rank',time_diff:null},10);
new Leaderboard(temp.scores,1,10);
new Page_tabs(temp.page_info);