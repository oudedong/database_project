const learderBoard = document.querySelector('#leaderboard');
const button_prev = document.querySelector('#button_prev');
const button_next = document.querySelector('#button_next');

class Date_tabs{

    static instance = null;

    constructor(){
        this.tab_elements = [];
        this.tab_st_dates = [];
        this.tab_end_dates = [];
        this.curTab = null;
    }
    static get_instance(){
        if (Date_tabs.instance == null){
            Date_tabs.instance = new Date_tabs();
        }
        return Date_tabs.instance;
    }
    add_tab(ele, st_date, diff=null, end_date=null){
        if(st_date != null){
            if(diff != null){
                end_date = new Date();
                end_date.setDate(st_date.getDate()-diff);
            }
            if(end_date == null){
                throw new Error('end_date is null...');
            }
        }
        this.tab_elements.push(ele);
        this.tab_st_dates.push(st_date);
        this.tab_end_dates.push(end_date);

        const i = this.tab_elements.length - 1;

        ele.addEventListener('click', (e)=>{
            e.preventDefault();
            this.click(i);
        });
    }
    click(i){
        console.log('date_tab_clicked:',i);
        if(this.curTab == i) return;
        this.curTab = i;
        for(let j=0; j < this.tab_elements.length; j++){
            if(j==i){
                this.tab_elements[j].classList.add('active');
                continue;
            }
            this.tab_elements[j].classList.remove('active');
        }
        document.dispatchEvent(new CustomEvent('click:date_tab', {detail:{date_st:this.tab_st_dates[i], date_end:this.tab_end_dates[i]}}))
    }
};
class Page_tabs{

    static instance = null;
    static get_instance(){
        if (Page_tabs.instance == null){
            Page_tabs.instance = new Page_tabs();
        }
        return Page_tabs.instance;
    }

    constructor(){
        this.tab_elements = [];
        this.page_diffs = [];
        this.target_pages = [];
        this.curPage = 1;
        this.num_pages = null;
    }
    add_tab(ele, page_diff=null){
        this.page_diffs.push(page_diff);
        this.target_pages.push(null);
        this.tab_elements.push(ele);

        const i = this.tab_elements.length - 1;

        ele.addEventListener('click', (e)=>{
            e.preventDefault();
            this.click(i);
        });
    }
    click(i){
        
        let target_page = null;

        if(this.page_diffs[i] != null){
            target_page = this.curPage + this.page_diffs[i];
        }
        else{
            target_page = this.target_pages[i];
        }
        if(target_page == this.curPage) return;
        if(target_page <= 0 || target_page > this.num_pages) return;
        this.curPage = target_page;
        console.log('target_Page:', target_page);
        this.update();

        document.dispatchEvent(new CustomEvent('click:page_tab', {detail:{curPage:this.curPage}}));
    }
    update(num_pages=null, curPage=null){

        if(num_pages != null)
            this.num_pages = num_pages;
        if(curPage != null)
            this.curPage = curPage;
        if(this.num_pages == null){
            throw new Error('page_tabs is not inited...');
        }

        let temp = [];

        for(let i = 0; i < this.tab_elements.length; i++){
            console.log(this.page_diffs[i]);
            if(this.page_diffs[i] != null)
                continue;
            temp.push(i);
        }
        let left_len = Math.max(Math.floor((temp.length-1)/2),0)
        let rigth_len = Math.max(temp.length-left_len-1,0);
        console.log(temp.length);
        console.log(left_len);
        console.log(rigth_len);
        for(let i = 0; i < left_len; i++){
            let i2 = temp[i];
            this.target_pages[i2] = this.curPage - (left_len-i);
            this.tab_elements[i2].textContent = this.target_pages[i2];
        }
        this.target_pages[temp[left_len]] = this.curPage
        this.tab_elements[temp[left_len]].textContent = this.target_pages[temp[left_len]];
        for(let i = 0; i < rigth_len; i++){
            let i2 = temp[i+left_len+1];
            this.target_pages[i2] = this.curPage + (i+1);
            this.tab_elements[i2].textContent = this.target_pages[i2];
        }

        for(let i = 0; i < this.tab_elements.length; i++){

            console.log(this.target_pages[i], this.curPage);
            if(this.target_pages[i] == this.curPage)
                this.tab_elements[i].classList.add('active');
            else
                this.tab_elements[i].classList.remove('active');

            let target_page = null

            if(this.page_diffs[i]!=null)
                target_page = this.curPage+this.page_diffs[i];
            else 
                target_page = this.target_pages[i];

            if(target_page <= 0 || target_page > this.num_pages)
                this.tab_elements[i].classList.add('disabled');
            else
                this.tab_elements[i].classList.remove('disabled');
        }
    }
}

async function get_page(page, range, page_size=10){

    let url = "/main/api/leaderboard"+`?page=${page}&page_size=${page_size}`
    if(range != null) url += `&range=${range}`;
    const response = await fetch(url);
    
    if(!response.ok){
        let error_msg = await response.text();
        alert(`failed to get leaderboard...: ${error_msg}`)
    }
    return response.json();
}
function make_list(list){

    for(let i = 0; i < list.length; i++){

        li = document.createElement('li');
        li.setAttribute('class','list-group-item d-flex');

        div_rank = document.createElement('div');
        div_result = document.createElement('div');

        div_rank.setAttribute('class', 'p-2');
        div_rank.textContent = i+1;
        div_result.setAttribute('class', 'p-2 flex-grow-1');


        div_name = document.createElement('div');
        div_score = document.createElement('div');
        div_time = document.createElement('div');
        div_date = document.createElement('div');


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

        learderBoard.appendChild(li);
    }
}
async function get_and_makeList(page, range){
    response = await get_page(page, range);
    make_list(response.scores);
    if(page == 1){
        classes = ['rank-first', 'rank-second', 'rank-third']
        for(let i = 0; i < 3 && i < learderBoard.childNodes.length; i++){
            learderBoard.childNodes[i].classList.add(classes[i]);
        }
    }
    return response.page_info;
}

const date_tabs = Date_tabs.get_instance();
date_tabs.add_tab(document.querySelector('#rank_total'), null);
date_tabs.add_tab(document.querySelector('#rank_weekly'), new Date(), 7);
date_tabs.add_tab(document.querySelector('#rank_month'), new Date(), 31);

const page_tabs = Page_tabs.get_instance();
const page_tabs_eles = document.querySelectorAll('.page-link');
for(let i=0; i < page_tabs_eles.length; i++){
    if(page_tabs_eles[i].textContent == 'prev')
        page_tabs.add_tab(page_tabs_eles[i], diff=-1);
    else if(page_tabs_eles[i].textContent == 'next')
        page_tabs.add_tab(page_tabs_eles[i], diff=1);
    else
        page_tabs.add_tab(page_tabs_eles[i]);
}

function dateToYMDString(date){
    console.log('at dateToYMDString:',date);
    let ret = '';
    ret += date.getFullYear();
    ret += String(date.getMonth()+1).padStart(2,'0');
    ret += String(date.getDate()).padStart(2,'0');
    return ret;
}
function clear_leaderBoard(){
    while(learderBoard.childNodes.length > 0){
        learderBoard.removeChild(learderBoard.childNodes[0]);
    }
}
document.addEventListener('click:date_tab',async (e)=>{
    date_st = e.detail.date_st;
    date_end = e.detail.date_end;
    curPage = 1;
    clear_leaderBoard();
    if(date_st != null && date_end != null)
        page_info = await get_and_makeList(curPage, dateToYMDString(date_st)+'~'+dateToYMDString(date_end));
    else
        page_info = await get_and_makeList(curPage, null);
    console.log(page_info);//
    page_tabs.update(page_info.num_pages, curPage);
})
document.addEventListener('click:page_tab',async (e)=>{
    curPage = e.detail.curPage;
    clear_leaderBoard();
    if(date_st != null && date_end != null)
        page_info = await get_and_makeList(curPage, dateToYMDString(date_st)+'~'+dateToYMDString(date_end));
    else
        page_info = await get_and_makeList(curPage, null);
})

let date_st = null;
let date_end = null;
let curPage = 1;

date_tabs.click(0);