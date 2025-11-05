
  const modeButton   = document.querySelector('#modeButton');
  const loginForm    = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');
  const errorBox     = document.querySelector('#error');
  const login_api_url = document.querySelector('#login_api_url').textContent;
  const register_api_url = document.querySelector('#register_api_url').textContent;

  const pop_error    = (message, type, parent)=>{
    const wrapper = document.createElement('div')
    wrapper.innerHTML = [
      `<div class="alert alert-${type} alert-dismissible" role="alert">`,
      `   <div>${message}</div>`,
      '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
      '</div>'
    ].join('')

    parent.appendChild(wrapper)
  }
  const login_reg_post = async (form, api_url)=>{
    
    const fd = new FormData(form);
    const r  = await fetch(api_url,{
      method: "POST",
      body  : fd,
    });

    const data = await r.json();
    if(!data.ok || !r.ok){
      return {ok:false, error:data.errors}
    }
    return {ok:true}
  }
  const login_reg_postprocess =  (result,eventName,node) =>{
    if (result.ok) {
      document.dispatchEvent(new CustomEvent(eventName));
    } else {
      error_msgs = Object.values(result.error || {}).flat().join('/');
      // console.log(result.ok);
      // console.log(result.error);
      // console.log(error_msgs);
      pop_error(error_msgs, 'warning', node);
    }
  }


  const next_page = new URL(window.location.href).searchParams.get('next') ?? '';
  // 초기 상태: 로그인 폼 보이기
  loginForm.hidden = false;
  registerForm.hidden = true;
  registerForm.classList.add('visually-hidden')
  modeButton.textContent = '회원가입으로';

  modeButton.addEventListener('click', () => {
    const showingLogin = !loginForm.hidden;
    loginForm.hidden    = showingLogin;
    registerForm.hidden = !showingLogin;
    modeButton.textContent = showingLogin ? '로그인으로' : '회원가입으로';
    loginForm.classList.toggle('visually-hidden');
    registerForm.classList.toggle('visually-hidden')
  });

  loginForm.addEventListener('submit', async (e) => {

    e.preventDefault();
    errorBox.textContent = '';

    let result = await login_reg_post(loginForm, login_api_url);
    login_reg_postprocess(result, 'auth:success',loginForm);
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';

    let result = await login_reg_post(registerForm, register_api_url);
    login_reg_postprocess(result, 'auth:success',registerForm);
  });

  document.addEventListener('auth:success',(e)=>{
    location.href = next_page;
  });