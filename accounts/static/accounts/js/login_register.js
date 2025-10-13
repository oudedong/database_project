
  const modeButton   = document.querySelector('#modeButton');
  const loginForm    = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');
  const errorBox     = document.querySelector('#error');
  const login_api_url = document.querySelector('#login_api_url').textContent;
  const register_api_url = document.querySelector('#register_api_url').textContent;
  
  const pop_error    = (message, type)=>{
    const wrapper = document.createElement('div')
    wrapper.innerHTML = [
      `<div class="alert alert-${type} alert-dismissible" role="alert">`,
      `   <div>${message}</div>`,
      '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
      '</div>'
    ].join('')

    errorBox.append(wrapper)
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
    const fd = new FormData(loginForm);
    const r  = await fetch(login_api_url, {
      method: "POST",
      body: fd,                         // csrfmiddlewaretoken 포함
      credentials: "same-origin",
    });
    const data = await r.json();
    if (r.ok && data.ok) {
      document.dispatchEvent(new CustomEvent('auth:login', {
        detail: data.user || null  // API에서 사용자 정보도 주면 전달
      }));
    } else {
      pop_error(Object.values(data.errors || {}).flat().join(" / "), 'warning');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    const fd = new FormData(registerForm);
    const r  = await fetch(register_api_url, {
      method: "POST",
      body: fd,                         // csrfmiddlewaretoken 포함
      credentials: "same-origin",
    });
    const data = await r.json();
    if (r.ok && data.ok) {
      document.dispatchEvent(new CustomEvent('auth:login', {
        detail: data.user || null  // API에서 사용자 정보도 주면 전달
      }));
    } else {
      pop_error(Object.values(data.errors || {}).flat().join(" / "), 'warning');
    }
  });

  document.addEventListener('auth:login',(e)=>{
    location.href = next_page;
  });