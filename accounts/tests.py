from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse


class AccountsTests(TestCase):
    def setUp(self):
        self.login_page_url = reverse('accounts:web:login')
        self.register_url = reverse('accounts:api:register')
        self.login_url = reverse('accounts:api:login')
        self.logout_url = reverse('accounts:api:logout')
        self.check_url = reverse('accounts:api:check_status')

    def test_login_page_renders(self):
        response = self.client.get(self.login_page_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'accounts/login_register.html')

    def test_register_auto_login_and_check_status(self):
        response = self.client.post(
            self.register_url,
            {
                'username': 'newplayer',
                'password1': 'StrongPass123!',
                'password2': 'StrongPass123!',
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'ok': True, 'data': {}})
        self.assertTrue(User.objects.filter(username='newplayer').exists())

        check = self.client.get(self.check_url)
        self.assertEqual(check.status_code, 200)
        payload = check.json()
        self.assertTrue(payload['ok'])
        self.assertTrue(payload['data']['authenticated'])
        self.assertEqual(payload['data']['user']['username'], 'newplayer')

    def test_logout_and_relogin_flow(self):
        User.objects.create_user(username='alice', password='Password123!')

        login_res = self.client.post(
            self.login_url,
            {'username': 'alice', 'password': 'Password123!'},
        )
        self.assertEqual(login_res.status_code, 200)
        self.assertEqual(login_res.json(), {'ok': True, 'data': {}})

        logout_res = self.client.post(self.logout_url)
        self.assertEqual(logout_res.status_code, 200)
        self.assertEqual(logout_res.json(), {'ok': True, 'data': {}})

        check = self.client.get(self.check_url)
        self.assertEqual(check.json(), {'ok': True, 'data': {'authenticated': False, 'user': None}})

    def test_login_with_wrong_password_returns_400(self):
        User.objects.create_user(username='bob', password='Password123!')
        res = self.client.post(
            self.login_url,
            {'username': 'bob', 'password': 'WrongPassword!'},
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertFalse(body['ok'])
        self.assertIn('error', body)
        self.assertIn('errors', body)

    def test_logout_when_unauthenticated_returns_400(self):
        res = self.client.post(self.logout_url)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json(), {'ok': False, 'error': 'already logout'})

    def test_duplicate_username_register_returns_400(self):
        User.objects.create_user(username='dupuser', password='Password123!')
        res = self.client.post(
            self.register_url,
            {
                'username': 'dupuser',
                'password1': 'StrongPass123!',
                'password2': 'StrongPass123!',
            },
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertFalse(body['ok'])
        self.assertIn('error', body)
        self.assertIn('errors', body)
