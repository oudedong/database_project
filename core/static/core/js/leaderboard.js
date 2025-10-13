const learderBoard = document.querySelector('#leaderboard');
const button_prev = document.querySelector('#button_prev');
const button_next = document.querySelector('#button_next');
const curPage = document.querySelector('#curPage');

async function get_page(page){

    const response = await fetch("/leaderboard_api"+`?page=${page}`);
    
    if(!response.ok){
        let error_msg = await response.text();
        alert(`failed to get leaderboard...: ${error_msg}`)
    }
    return response.json();
}
function make_list(list){

    for(let i = 0; i < list.length; i++){

        li = document.createElement('li');

        if(i==0){
            li.classList.add('rank-first');
        }
        else if(i==1){
            li.classList.add('rank-second');
        }
        else if(i==2){
            li.classList.add('rank-third');
        }
        else{
            li.classList.add('rank-out');
        }

        li.classList.add('list-group-item')

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

        li.appendChild(div_name);
        li.appendChild(div_score);
        li.appendChild(div_time);
        li.appendChild(div_date);
        learderBoard.appendChild(li);
    }
}
function set_page_buttons(pageInfo){
    if(pageInfo.prev)
        button_prev.classList.remove('disabled');
    else
        button_prev.classList.add('disabled');
    if(pageInfo.next)
        button_next.classList.remove('disabled');
    else
        button_next.classList.add('disabled');
    curPage.textContent = pageInfo.curPage;
}
async function do_all(page){
    response = await get_page(page);
    make_list(response.scores);
    set_page_buttons(response.page_info)
}

button_next.addEventListener('click',()=>{
    if(!button_next.classList.contains('disabled'))
        do_all(curPage.textContent+1);
})
button_prev.addEventListener('click',()=>{
    if(!button_prev.classList.contains('disabled'))
    do_all(curPage.textContent-1);
})
do_all(1);