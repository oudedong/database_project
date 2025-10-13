import {getCookie} from '../../../../static/js/common.js';

const csrftoken = getCookie('csrftoken');
const logout_button = document.querySelector('#logout');
if(logout_button){
    logout_button.addEventListener('click',async (e)=>{
        e.preventDefault();
        const r = await fetch('/accounts/logout_api/',{
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },   // ★ CSRF
            credentials: "same-origin",
        })
        if (r.ok){
            location.reload();
        }
        else{
            msg = await r.json() //body는 헤더하고 비동기적...
            alert(`failed to logout: ${msg.errors}`)
        }
    });
}