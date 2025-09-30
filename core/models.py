from django.db import models
from django.contrib.auth.models import User
import datetime

# Create your models here.
class Result(models.Model):
    gameId = models.BigAutoField(primary_key=True)
    userId = models.ForeignKey(User, on_delete=models.CASCADE)
    time   = models.IntegerField(null=True)
    score  = models.IntegerField(null=True)
    date   = models.DateField(default=datetime.date.today)