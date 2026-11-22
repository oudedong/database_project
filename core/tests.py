import datetime
import json
import uuid
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import GameSession, Result
from .valify2 import verify_full_game_log


def build_valid_game_payload(seed: int = 42) -> dict:
    """board_size=5에서 정상 검증을 통과하는 최소 게임 로그(인접 배치+머지 포함)를 생성."""
    return {
        'seed': seed,
        'score': 2,
        'actions': [
            # (0,0)=1의 인접 빈칸 (1,0)에 val=1 배치 -> 자식 합(1)==부모(1) 머지로 (0,0)=2
            {
                'x_from': 0,
                'y_from': 0,
                'x_dest': 1,
                'y_dest': 0,
                'val': 1,
                'max_value': 2,
            },
            # 다음 cur_value는 floor(rand * (2//2)) + 1 = 1
            {
                'x_from': 0,
                'y_from': 0,
                'x_dest': 1,
                'y_dest': 0,
                'val': 1,
                'max_value': 2,
            },
        ],
    }


class VerifyFullGameLogTests(TestCase):
    def test_valid_game_log_passes(self):
        payload = build_valid_game_payload()
        self.assertTrue(verify_full_game_log(payload, board_size=5))

    def test_same_value_add_passes(self):
        payload = {
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
        self.assertTrue(verify_full_game_log(payload, board_size=5))

    def test_empty_actions_or_missing_field_fails(self):
        self.assertFalse(verify_full_game_log({'seed': 1, 'score': 1, 'actions': []}, 5))
        self.assertFalse(verify_full_game_log({'seed': 1, 'score': 1}, 5))

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

    def test_unauthenticated_start_and_submit_return_401(self):
        start_res = self.client.post(self.start_url)
        self.assertEqual(start_res.status_code, 401)

        submit_res = self._post_json(
            self.submit_url,
            {**build_valid_game_payload(), 'session_id': str(uuid.uuid4())},
        )
        self.assertEqual(submit_res.status_code, 401)

    def test_start_and_submit_calculates_server_elapsed_time(self):
        self.client.force_login(self.user)
        t0 = datetime.datetime(2026, 11, 22, 12, 0, 0, tzinfo=datetime.timezone.utc)
        t1 = t0 + datetime.timedelta(seconds=42)

        with patch('django.utils.timezone.now', return_value=t0):
            start_res = self.client.post(self.start_url)
        self.assertEqual(start_res.status_code, 200)
        session_id = start_res.json()['session_id']

        session = GameSession.objects.get(id=session_id)
        self.assertIsNone(session.submitted_at)

        payload = {**build_valid_game_payload(), 'session_id': session_id, 'time': 1}
        with patch('django.utils.timezone.now', return_value=t1):
            submit_res = self._post_json(self.submit_url, payload)

        self.assertEqual(submit_res.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(session.submitted_at, t1)
        self.assertIsNotNone(session.result)
        self.assertEqual(session.result.score, 2)
        # 클라이언트가 보낸 time=1이 아니라 서버 경과 시간 42초가 저장되어야 함
        self.assertEqual(session.result.time, 42)

    def test_duplicate_submit_is_rejected_with_409(self):
        self.client.force_login(self.user)
        session_id = self.client.post(self.start_url).json()['session_id']
        payload = {**build_valid_game_payload(), 'session_id': session_id}

        first = self._post_json(self.submit_url, payload)
        self.assertEqual(first.status_code, 200)

        second = self._post_json(self.submit_url, payload)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(Result.objects.filter(user=self.user).count(), 1)

    def test_new_start_deletes_previous_unsubmitted_session_only(self):
        self.client.force_login(self.user)

        # 첫 번째 세션 시작 후 제출 완료 -> 보존되어야 함
        s1 = self.client.post(self.start_url).json()['session_id']
        self.assertEqual(
            self._post_json(self.submit_url, {**build_valid_game_payload(), 'session_id': s1}).status_code,
            200,
        )

        # 두 번째 세션 시작(미제출) -> 세 번째 세션 시작 시 두 번째 세션은 삭제되어야 함
        s2 = self.client.post(self.start_url).json()['session_id']
        s3 = self.client.post(self.start_url).json()['session_id']

        self.assertTrue(GameSession.objects.filter(id=s1).exists())
        self.assertFalse(GameSession.objects.filter(id=s2).exists())
        self.assertTrue(GameSession.objects.filter(id=s3).exists())

        # 만료된 s2로 제출 시 거절, 최신 s3로는 정상 제출
        res_s2 = self._post_json(self.submit_url, {**build_valid_game_payload(), 'session_id': s2})
        self.assertEqual(res_s2.status_code, 404)

        res_s3 = self._post_json(self.submit_url, {**build_valid_game_payload(), 'session_id': s3})
        self.assertEqual(res_s3.status_code, 200)

    def test_cannot_submit_other_users_session(self):
        self.client.force_login(self.user)
        s1 = self.client.post(self.start_url).json()['session_id']

        self.client.force_login(self.other_user)
        res = self._post_json(self.submit_url, {**build_valid_game_payload(), 'session_id': s1})
        self.assertEqual(res.status_code, 404)

    def test_failed_validation_does_not_mark_session_submitted(self):
        self.client.force_login(self.user)
        session_id = self.client.post(self.start_url).json()['session_id']
        bad_payload = {**build_valid_game_payload(), 'session_id': session_id, 'score': 999}

        res = self._post_json(self.submit_url, bad_payload)
        self.assertEqual(res.status_code, 400)
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
        scores = res_all.json()['scores']
        self.assertEqual(len(scores), 3)
        # 점수 내림차순, 같으면 시간 오름차순: u2(200, 40) -> u1(200, 50) -> u1(100, 30)
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
        self.assertEqual(len(res_range.json()['scores']), 1)
        self.assertEqual(res_range.json()['scores'][0]['username'], 'u1')

    def test_user_rank_returns_best_per_user(self):
        res = self.client.get(self.url, {'type': 'user_rank'})
        self.assertEqual(res.status_code, 200)
        scores = res.json()['scores']
        self.assertEqual(len(scores), 2)
        self.assertEqual([(s['username'], s['score'], s['time']) for s in scores], [
            ('u2', 200, 40),
            ('u1', 200, 50),
        ])

    def test_pagination_and_invalid_params(self):
        res_page = self.client.get(self.url, {'type': 'date_rank', 'page': 2, 'page_size': 2})
        self.assertEqual(res_page.status_code, 200)
        body = res_page.json()
        self.assertEqual(len(body['scores']), 1)
        self.assertEqual(body['page_info'], {'prev': True, 'next': False, 'curPage': 2, 'num_pages': 2})

        self.assertEqual(self.client.get(self.url, {'type': 'unknown'}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'range': 'bad-format'}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'page': 'abc'}).status_code, 400)
