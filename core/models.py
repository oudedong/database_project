from django.db import models
import datetime
import uuid

# Create your models here.
class Result(models.Model):
    nickname = models.CharField(max_length=20, default='Anonymous', db_index=True)
    time   = models.IntegerField(null=True)
    score  = models.IntegerField(null=True)
    date   = models.DateField(default=datetime.date.today)


class GameSession(models.Model):
    """서버 기준 게임 시작/제출 시간 추적 및 중복 제출 방지용 세션."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seed = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    submitted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    result = models.OneToOneField(
        Result,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='game_session',
    )