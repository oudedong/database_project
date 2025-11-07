const learderBoard = document.querySelector('#leaderboard');
const leaderboard_api_url = document.querySelector('#leaderboard_api_url').textContent;

class Date_tabs{

    static tab_elements = [];
    static diffs = [];
    static curTab = 0;

    static add_tab(ele, diff){
        
        Date_tabs.tab_elements.push(ele);
        Date_tabs.diffs.push(diff);

        const i = Date_tabs.tab_elements.length - 1;

        ele.addEventListener('click', (e)=>{
            e.preventDefault();

            document.dispatchEvent(
                new CustomEvent(
                    'click:date_tab', 
                    {detail:Date_tabs.get_range(i)}
                ));
            Date_tabs.curTab = i;
            Date_tabs.update();
        });
    }
    static update(){
        for(let i = 0; i < Date_tabs.tab_elements.length; i++){
            if(i != Date_tabs.curTab){
                Date_tabs.tab_elements[i].classList.remove('active');
                continue;
            }
            Date_tabs.tab_elements[i].classList.add('active');
        }
    }
    static get_range(i){
        let st = null;
        let end = null;
        if(Date_tabs.diffs[i] != null){
            st = new Date()
            st.setDate(new Date().getDay()-Date_tabs.diffs[i]);
            end = new Date();
        }
        return {date_st:st, date_end:end};
    }
};
class Leaderboard{

    static board = document.querySelector('#leaderboard');

    constructor(list,page_num,page_size){
        Leaderboard.board.innerHTML = '';
        for(let i = 0; i < list.length; i++){

            let li = document.createElement('li');
            li.setAttribute('class','list-group-item d-flex');

            let div_rank = document.createElement('div');
            div_rank.setAttribute('class', 'p-2');
            div_rank.textContent = i+1 + (page_num-1)*page_size;

            let div_result = document.createElement('div');
            div_result.setAttribute('class', 'p-2 flex-grow-1');


            let div_name = document.createElement('div');
            let div_score = document.createElement('div');
            let div_time = document.createElement('div');
            let div_date = document.createElement('div');
            div_name.setAttribute('class', 'name');
            div_score.setAttribute('class', 'score');
            div_time.setAttribute('class', 'time');
            div_time.setAttribute('class', 'date');

            div_name.textContent = `username: ${list[i].username}`;
            div_score.textContent = `score: ${list[i].score}`;
            div_time.textContent = `time: ${list[i].time}`;
            div_date.textContent = `date: ${list[i].date}`;

            div_result.appendChild(div_name);
            div_result.appendChild(div_score);
            div_result.appendChild(div_time);
            div_result.appendChild(div_date);

            li.appendChild(div_rank);
            li.appendChild(div_result);

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


async function get_page(page, range=null, page_size=10){

    let url = leaderboard_api_url+`?page=${page}&page_size=${page_size}`;
    console.log(url);
    if(range != null) url += `&range=${range}`;
    const response = await fetch(url);
    
    if(!response.ok){
        let error_msg = await response.text();
        alert(`failed to get leaderboard...: ${error_msg}`)
    }
    return response.json();
}


function dateToYMDString(date){
    console.log('at dateToYMDString:',date);
    let ret = '';
    ret += date.getFullYear();
    ret += String(date.getMonth()+1).padStart(2,'0');
    ret += String(date.getDate()).padStart(2,'0');
    return ret;
}
document.addEventListener('click:date_tab',async (e)=>{

    let date_st = e.detail.date_st;
    let date_end = e.detail.date_end;
    let range = null;
    if(date_st != null && date_end != null){
        range = dateToYMDString(date_st)+'~'+dateToYMDString(date_end);
    }
    
    let response = await get_page(1,range);
    new Leaderboard(response.scores,1,10);
    new Page_tabs(response.page_info);
})
document.addEventListener('click:page_tab',async (e)=>{

    let temp = Date_tabs.get_range(Date_tabs.curTab);
    let curPage = e.detail.curPage;
    let date_st = temp.date_st;
    let date_end = temp.date_end;
    let range = null;

    if(date_st != null && date_end != null){
        range = dateToYMDString(date_st)+'~'+dateToYMDString(date_end);
    }
    
    let response = await get_page(curPage,range);
    new Leaderboard(response.scores,curPage,10);
    new Page_tabs(response.page_info);
})

Date_tabs.add_tab(document.querySelector('#rank_total'), null);
Date_tabs.add_tab(document.querySelector('#rank_weekly'), 7);
Date_tabs.add_tab(document.querySelector('#rank_month'), 31);

let temp = await get_page(1,null);
new Leaderboard(temp.scores,1,10);
new Page_tabs(temp.page_info);