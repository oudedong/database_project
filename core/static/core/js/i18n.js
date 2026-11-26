const STORAGE_KEY = 'tp_lang';

export const TRANSLATIONS = {
  ko: {
    'nav.play': '플레이',
    'nav.leaderboard': '리더보드',
    'hud.score': '점수',
    'hud.time': '시간',
    'hud.next': '다음',
    'game.restart': '새 게임',
    'game.nicknamePlaceholder': '닉네임 (1~20자)',
    'game.submit': '점수 제출',
    'rules.title': '게임 규칙',
    'rules.step1': '노드를 클릭한 뒤 인접한 빈 칸(8방향)에 다음 숫자를 연결하거나, 같은 숫자를 클릭해 더합니다.',
    'rules.step2': '간선은 방향이 없으며, 이웃한 끝쪽(차수 1) 노드들의 합이 기준 노드와 같아지면 합쳐져 2배가 됩니다.',
    'rules.step3Html': '게임 종료 후 <strong>원하는 닉네임</strong>을 입력해 리더보드에 점수를 제출할 수 있습니다.',
    'alert.nicknameRequired': '닉네임을 1~20자로 입력해 주세요.',
    'alert.submitSuccess': '점수가 성공적으로 제출되었습니다!',
    'alert.submitFailed': '제출 실패: {error}',
    'alert.serverError': '서버가 응답하지 않습니다.',
    'alert.gameOver': '게임 종료! 최종 점수: {score}점',
    'lb.title': '리더보드',
    'lb.backToGame': '게임으로 돌아가기',
    'lb.tabTotal': '전체',
    'lb.tabWeekly': '주간',
    'lb.tabMonth': '월간',
    'lb.tabUser': '유저별 최고',
    'lb.prev': '이전',
    'lb.next': '다음',
    'lb.empty': '아직 등록된 기록이 없습니다.',
    'lb.scoreUnit': '{score}점',
    'lb.timeUnit': '{time}초',
    'lb.loadFailed': '리더보드를 불러오지 못했습니다: {error}',
  },
  en: {
    'nav.play': 'Play',
    'nav.leaderboard': 'Leaderboard',
    'hud.score': 'Score',
    'hud.time': 'Time',
    'hud.next': 'Next',
    'game.restart': 'New Game',
    'game.nicknamePlaceholder': 'Nickname (1-20 chars)',
    'game.submit': 'Submit',
    'rules.title': 'How to Play',
    'rules.step1': 'Click a node to connect the next number to an adjacent empty cell (8 directions), or click a matching number to double it.',
    'rules.step2': 'Edges are undirected. When leaf neighbors (degree 1) sum up to a node’s value, they merge into it and double its value.',
    'rules.step3Html': 'When the game ends, enter <strong>any nickname</strong> to submit your score to the leaderboard.',
    'alert.nicknameRequired': 'Please enter a nickname (1-20 characters).',
    'alert.submitSuccess': 'Score submitted successfully!',
    'alert.submitFailed': 'Submit failed: {error}',
    'alert.serverError': 'Server is not responding.',
    'alert.gameOver': 'Game Over! Final Score: {score}',
    'lb.title': 'Leaderboard',
    'lb.backToGame': 'Back to Game',
    'lb.tabTotal': 'All Time',
    'lb.tabWeekly': 'Weekly',
    'lb.tabMonth': 'Monthly',
    'lb.tabUser': 'Best per Player',
    'lb.prev': 'Prev',
    'lb.next': 'Next',
    'lb.empty': 'No scores yet.',
    'lb.scoreUnit': '{score} pts',
    'lb.timeUnit': '{time}s',
    'lb.loadFailed': 'Failed to load leaderboard: {error}',
  },
};

export function detectInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ko' || saved === 'en') {
      return saved;
    }
  } catch (_) {}

  const browserLang = (
    (Array.isArray(navigator.languages) && navigator.languages[0]) ||
    navigator.language ||
    ''
  ).toLowerCase();

  return browserLang.startsWith('ko') ? 'ko' : 'en';
}

let currentLang = detectInitialLang();

export function getLang() {
  return currentLang;
}

export function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml;
    el.innerHTML = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    el.setAttribute('placeholder', t(key));
  });

  document.querySelectorAll('#lang-toggle [data-lang]').forEach((btn) => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

export function setLang(lang) {
  if (lang !== 'ko' && lang !== 'en') return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {}
  applyTranslations();
  document.dispatchEvent(new CustomEvent('tp:langchange', { detail: { lang } }));
}

export function initI18n() {
  applyTranslations();
  const toggle = document.querySelector('#lang-toggle');
  if (toggle && !toggle.dataset.i18nBound) {
    toggle.dataset.i18nBound = '1';
    toggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (btn) {
        setLang(btn.dataset.lang);
      }
    });
  }
}
