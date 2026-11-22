import datetime
import json
import uuid
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import GameSession, Result
from .valify2 import MAX_ACTIONS, GameSimulator, NodeSim, Rng, verify_full_game_log


def build_valid_actions() -> list[dict]:
    """어떤 seed에서든 첫 2턴이 유효한 최소 게임 액션 목록을 생성."""
    return [
        # (0,0)=1의 인접 빈칸 (1,0)에 val=1 배치 -> 자식 합(1)==부모(1) 머지로 (0,0)=2
        {
            'x_from': 0,
            'y_from': 0,
            'x_dest': 1,
            'y_dest': 0,
            'val': 1,
            'max_value': 2,
        },
        # 다음 cur_value는 floor(rand * (2//2)) + 1 = 1 (seed와 무관하게 항상 1)
        {
            'x_from': 0,
            'y_from': 0,
            'x_dest': 1,
            'y_dest': 0,
            'val': 1,
            'max_value': 2,
        },
    ]


def build_valid_game_payload(seed: int = 42) -> dict:
    return {
        'seed': seed,
        'score': 2,
        'actions': build_valid_actions(),
    }


class VerifyFullGameLogTests(TestCase):
    def test_valid_game_log_passes(self):
        payload = build_valid_game_payload()
        self.assertTrue(verify_full_game_log(payload, board_size=5))

    def test_same_value_add_updates_max_value(self):
        payload = {
            'seed': 7,
            'score': 2,
            'actions': [
                {
                    'x_from': -1,
                    'y_from': -1,
                    'x_dest': 0,
                    'y_dest': 0,
                    'val': 1,
                    'max_value': 2,
                },
            ],
        }
        self.assertTrue(verify_full_game_log(payload, board_size=5))

        stale_max = {
            'seed': 7,
            'score': 1,
            'actions': [
                {
                    'x_from': -1,
                    'y_from': -1,
                    'x_dest': 0,
                    'y_dest': 0,
                    'val': 1,
                    'max_value': 1,
                },
            ],
        }
        self.assertFalse(verify_full_game_log(stale_max, board_size=5))

    def test_undirected_reverse_and_cascading_merge(self):
        """끝쪽 루트가 자식 방향으로 합쳐지고 연쇄 머지까지 일어나는지 검증."""
        sim = GameSimulator(seed=1, board_size=5)
        n0 = sim.board.node(0, 0)  # val=1
        n1 = sim.board.node(1, 0)
        n2 = sim.board.node(2, 0)
        n1.value = 2
        n2.value = 4
        n0.connect(n1)
        n1.connect(n2)
        sim.board.cnt_empty -= 2
        sim.board.max_value = 4

        # (0,0)에 same-value add(1) -> (0,0)=2 -> (1,0)=4 -> (2,0)=8 연쇄 머지
        sim.step({'x_from': -1, 'y_from': -1, 'x_dest': 0, 'y_dest': 0, 'val': 1, 'max_value': 8})
        self.assertTrue(n0.is_empty())
        self.assertTrue(n1.is_empty())
        self.assertEqual(n2.value, 8)
        self.assertEqual(n2.neighbors, [])
        self.assertEqual(sim.board.max_value, 8)

    def test_internal_node_is_not_absorbed_preventing_disconnection(self):
        """차수 >= 2인 중간 노드는 끝쪽 노드에 의해 흡수되지 않아 그래프가 끊기지 않는다."""
        n0 = NodeSim(value=2)
        n1 = NodeSim(value=2)
        n2 = NodeSim(value=2)
        n0.connect(n1)
        n1.connect(n2)

        # 끝쪽 n0에서 머지를 시도해도 n1은 차수가 2이므로 흡수되지 않아야 함
        self.assertIsNone(n0.merge_from_leaves())
        self.assertEqual(n1.value, 2)
        self.assertEqual(len(n1.neighbors), 2)

        # 반면 중간 노드 n1은 끝쪽 n0(또는 n2)를 흡수해 (n1=4 — n2=2)로 연결을 유지함
        res = n1.merge_from_leaves()
        self.assertIsNotNone(res)
        self.assertEqual(n1.value, 4)
        self.assertEqual(n1.neighbors, [n2])
        self.assertEqual(n2.neighbors, [n1])

    def test_next_cur_value_is_always_power_of_two(self):
        """score 값에 관계없이 다음 cur_value는 항상 2^k <= max(1, score // 2)여야 한다."""
        self.assertEqual(GameSimulator(seed=1, board_size=5).cur_value, 1)

        for score in (2, 4, 8, 16, 32, 64):
            generated = set()
            for seed in range(1, 50):
                sim = GameSimulator(seed=seed, board_size=5)
                sim.board.max_value = score
                sim.step({
                    'x_from': -1,
                    'y_from': -1,
                    'x_dest': 0,
                    'y_dest': 0,
                    'val': 1,
                    'max_value': score,
                })
                val = sim.cur_value
                self.assertGreaterEqual(val, 1)
                self.assertLessEqual(val, max(1, score // 2))
                self.assertEqual(val & (val - 1), 0, f'{val} is not a power of two')
                generated.add(val)
            if score >= 8:
                self.assertGreater(len(generated), 1)

        # 2의 거듭제곱이 아닌 val(예: 3)은 두 번째 턴에서 절대 생성되지 않으므로 거절되어야 함
        non_pow2_payload = {
            'seed': 42,
            'score': 8,
            'actions': [
                {'x_from': -1, 'y_from': -1, 'x_dest': 0, 'y_dest': 0, 'val': 1, 'max_value': 2},
                {'x_from': -1, 'y_from': -1, 'x_dest': 0, 'y_dest': 0, 'val': 2, 'max_value': 4},
                {'x_from': -1, 'y_from': -1, 'x_dest': 0, 'y_dest': 0, 'val': 4, 'max_value': 8},
                {'x_from': 0, 'y_from': 0, 'x_dest': 1, 'y_dest': 0, 'val': 3, 'max_value': 8},
            ],
        }
        self.assertFalse(verify_full_game_log(non_pow2_payload, board_size=5))

    def test_empty_actions_or_missing_field_or_exceed_max_actions_fails(self):
        self.assertFalse(verify_full_game_log({'seed': 1, 'score': 1, 'actions': []}, 5))
        self.assertFalse(verify_full_game_log({'seed': 1, 'score': 1}, 5))

        too_many = {
            'seed': 1,
            'score': 2,
            'actions': [{'x_from': 0, 'y_from': 0, 'x_dest': 1, 'y_dest': 0, 'val': 1, 'max_value': 2}]
            * (MAX_ACTIONS + 1),
        }
        self.assertFalse(verify_full_game_log(too_many, 5))

    def test_tampered_score_or_val_or_non_adjacent_fails(self):
        tampered_score = build_valid_game_payload()
        tampered_score['score'] = 999
        self.assertFalse(verify_full_game_log(tampered_score, 5))

        tampered_val = build_valid_game_payload()
        tampered_val['actions'][0]['val'] = 4
        self.assertFalse(verify_full_game_log(tampered_val, 5))

        non_adjacent = {
            'seed': 1,
            'score': 1,
            'actions': [
                {
                    'x_from': 0,
                    'y_from': 0,
                    'x_dest': 3,
                    'y_dest': 3,
                    'val': 1,
                    'max_value': 1,
                }
            ],
        }
        self.assertFalse(verify_full_game_log(non_adjacent, 5))


class GameSessionAndSubmitTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='player1', password='Password123!')
        self.other_user = User.objects.create_user(username='player2', password='Password123!')
        self.start_url = reverse('core:api:start')
        self.submit_url = reverse('core:api:submit')

    def _post_json(self, url, data):
        return self.client.post(url, data=json.dumps(data), content_type='application/json')

    def test_unauthenticated_start_and_submit_return_401_json(self):
        start_res = self.client.post(self.start_url)
        self.assertEqual(start_res.status_code, 401)
        self.assertFalse(start_res.json()['ok'])

        submit_res = self._post_json(
            self.submit_url,
            {'session_id': str(uuid.uuid4()), 'score': 2, 'actions': build_valid_actions()},
        )
        self.assertEqual(submit_res.status_code, 401)
        self.assertFalse(submit_res.json()['ok'])

    def test_start_issues_seed_and_submit_without_client_seed_succeeds(self):
        self.client.force_login(self.user)
        t0 = datetime.datetime(2026, 11, 22, 12, 0, 0, tzinfo=datetime.timezone.utc)
        t1 = t0 + datetime.timedelta(seconds=42)

        with patch('django.utils.timezone.now', return_value=t0):
            start_res = self.client.post(self.start_url)
        self.assertEqual(start_res.status_code, 200)
        start_body = start_res.json()
        self.assertTrue(start_body['ok'])
        session_id = start_body['data']['session_id']
        server_seed = start_body['data']['seed']

        session = GameSession.objects.get(id=session_id)
        self.assertEqual(session.seed, server_seed)
        self.assertIsNone(session.submitted_at)

        payload = {'session_id': session_id, 'score': 2, 'actions': build_valid_actions()}
        with patch('django.utils.timezone.now', return_value=t1):
            submit_res = self._post_json(self.submit_url, payload)

        self.assertEqual(submit_res.status_code, 200)
        self.assertEqual(submit_res.json(), {'ok': True, 'data': {'score': 2, 'time': 42}})
        session.refresh_from_db()
        self.assertEqual(session.submitted_at, t1)
        self.assertEqual(session.result.score, 2)
        self.assertEqual(session.result.time, 42)

    def test_client_seed_is_ignored_in_submit(self):
        """클라이언트가 다른 seed를 실어 보내더라도 서버는 session.seed로만 검증한다."""
        self.client.force_login(self.user)
        with patch('core.views.secrets.randbelow', return_value=12345):
            session_id = self.client.post(self.start_url).json()['data']['session_id']

        # (0,0)=2 -> (1,0)=1 -> (0,1)=1 이후 max_value=4가 되는 4턴 로그를 만든 뒤
        # 4턴째 cur_value가 서버 시드(12345)와 다른 임의 시드 기준이면 실패해야 함
        from .valify2 import Rng
        server_rng = Rng(12345)
        server_rng.random()  # turn1 -> max=2, cur=1
        # turn2: (1,0)=1 + (0,0)=2 -> no merge (max=2)
        server_rng.random()
        # turn3: (0,1)=1 -> (0,0) children sum(1+1)==2 -> merge! (0,0)=4
        r3 = server_rng.random()
        cur_v4_server = int(r3 * (4 // 2)) + 1  # 1 or 2
        wrong_v4 = 2 if cur_v4_server == 1 else 1

        actions = [
            {'x_from': 0, 'y_from': 0, 'x_dest': 1, 'y_dest': 0, 'val': 1, 'max_value': 2},
            {'x_from': 0, 'y_from': 0, 'x_dest': 1, 'y_dest': 0, 'val': 1, 'max_value': 2},
            {'x_from': 0, 'y_from': 0, 'x_dest': 0, 'y_dest': 1, 'val': 1, 'max_value': 4},
            {'x_from': 0, 'y_from': 0, 'x_dest': 1, 'y_dest': 0, 'val': wrong_v4, 'max_value': 4},
        ]
        res = self._post_json(
            self.submit_url,
            {'session_id': session_id, 'seed': 99999, 'score': 4, 'actions': actions},
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['ok'])

    def test_duplicate_submit_is_rejected_with_409(self):
        self.client.force_login(self.user)
        session_id = self.client.post(self.start_url).json()['data']['session_id']
        payload = {'session_id': session_id, 'score': 2, 'actions': build_valid_actions()}

        first = self._post_json(self.submit_url, payload)
        self.assertEqual(first.status_code, 200)

        second = self._post_json(self.submit_url, payload)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json(), {'ok': False, 'error': 'already submitted'})
        self.assertEqual(Result.objects.filter(user=self.user).count(), 1)

    def test_new_start_deletes_previous_unsubmitted_session_only(self):
        self.client.force_login(self.user)

        s1 = self.client.post(self.start_url).json()['data']['session_id']
        self.assertEqual(
            self._post_json(
                self.submit_url,
                {'session_id': s1, 'score': 2, 'actions': build_valid_actions()},
            ).status_code,
            200,
        )

        s2 = self.client.post(self.start_url).json()['data']['session_id']
        s3 = self.client.post(self.start_url).json()['data']['session_id']

        self.assertTrue(GameSession.objects.filter(id=s1).exists())
        self.assertFalse(GameSession.objects.filter(id=s2).exists())
        self.assertTrue(GameSession.objects.filter(id=s3).exists())

        res_s2 = self._post_json(
            self.submit_url,
            {'session_id': s2, 'score': 2, 'actions': build_valid_actions()},
        )
        self.assertEqual(res_s2.status_code, 404)

        res_s3 = self._post_json(
            self.submit_url,
            {'session_id': s3, 'score': 2, 'actions': build_valid_actions()},
        )
        self.assertEqual(res_s3.status_code, 200)

    def test_cannot_submit_other_users_session(self):
        self.client.force_login(self.user)
        s1 = self.client.post(self.start_url).json()['data']['session_id']

        self.client.force_login(self.other_user)
        res = self._post_json(
            self.submit_url,
            {'session_id': s1, 'score': 2, 'actions': build_valid_actions()},
        )
        self.assertEqual(res.status_code, 404)

    def test_failed_validation_does_not_mark_session_submitted(self):
        self.client.force_login(self.user)
        session_id = self.client.post(self.start_url).json()['data']['session_id']
        bad_payload = {'session_id': session_id, 'score': 999, 'actions': build_valid_actions()}

        res = self._post_json(self.submit_url, bad_payload)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['ok'])
        session = GameSession.objects.get(id=session_id)
        self.assertIsNone(session.submitted_at)
        self.assertIsNone(session.result)


class LeaderboardTests(TestCase):
    def setUp(self):
        self.u1 = User.objects.create_user(username='u1', password='Password123!')
        self.u2 = User.objects.create_user(username='u2', password='Password123!')
        self.url = reverse('core:api:leaderboard')

        Result.objects.create(user=self.u1, score=100, time=30, date=datetime.date(2026, 11, 1))
        Result.objects.create(user=self.u1, score=200, time=50, date=datetime.date(2026, 11, 10))
        Result.objects.create(user=self.u2, score=200, time=40, date=datetime.date(2026, 11, 15))

    def test_date_rank_all_and_range_filter(self):
        res_all = self.client.get(self.url, {'type': 'date_rank', 'page_size': 10})
        self.assertEqual(res_all.status_code, 200)
        body = res_all.json()
        self.assertTrue(body['ok'])
        scores = body['data']['scores']
        self.assertEqual(len(scores), 3)
        self.assertEqual([(s['username'], s['score'], s['time']) for s in scores], [
            ('u2', 200, 40),
            ('u1', 200, 50),
            ('u1', 100, 30),
        ])

        res_range = self.client.get(
            self.url,
            {'type': 'date_rank', 'range': '20261105~20261112'},
        )
        self.assertEqual(res_range.status_code, 200)
        self.assertEqual(len(res_range.json()['data']['scores']), 1)
        self.assertEqual(res_range.json()['data']['scores'][0]['username'], 'u1')

    def test_user_rank_returns_best_per_user(self):
        res = self.client.get(self.url, {'type': 'user_rank'})
        self.assertEqual(res.status_code, 200)
        scores = res.json()['data']['scores']
        self.assertEqual(len(scores), 2)
        self.assertEqual([(s['username'], s['score'], s['time']) for s in scores], [
            ('u2', 200, 40),
            ('u1', 200, 50),
        ])

    def test_pagination_and_invalid_params(self):
        res_page = self.client.get(self.url, {'type': 'date_rank', 'page': 2, 'page_size': 2})
        self.assertEqual(res_page.status_code, 200)
        data = res_page.json()['data']
        self.assertEqual(len(data['scores']), 1)
        self.assertEqual(data['page_info'], {'prev': True, 'next': False, 'curPage': 2, 'num_pages': 2})

        for params in [
            {'type': 'unknown'},
            {'range': 'bad-format'},
            {'page': 'abc'},
            {'page': 0},
            {'page_size': 0},
            {'page_size': 101},
        ]:
            err_res = self.client.get(self.url, params)
            self.assertEqual(err_res.status_code, 400)
            self.assertFalse(err_res.json()['ok'])
            self.assertIn('error', err_res.json())


class PageRenderTests(TestCase):
    def test_main_and_leaderboard_pages_contain_required_hooks(self):
        main_res = self.client.get(reverse('core:web:main'))
        self.assertEqual(main_res.status_code, 200)
        for hook in ('id="board"', 'id="wires"', 'id="start_url"', 'id="submit_url"', 'id="game-alert"'):
            self.assertContains(main_res, hook)

        lb_res = self.client.get(reverse('core:web:leaderboard'))
        self.assertEqual(lb_res.status_code, 200)
        for hook in ('id="leaderboard"', 'id="leaderboard_api_url"', 'id="pages"'):
            self.assertContains(lb_res, hook)

        login_res = self.client.get(reverse('accounts:web:login'))
        self.assertEqual(login_res.status_code, 200)
        for hook in ('id="loginForm"', 'id="registerForm"', 'id="modeButton"', 'id="error"'):
            self.assertContains(login_res, hook)
