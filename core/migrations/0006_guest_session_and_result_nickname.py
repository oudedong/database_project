from django.db import migrations, models


def backfill_result_nicknames(apps, schema_editor):
    Result = apps.get_model('core', 'Result')
    for res in Result.objects.select_related('user').all():
        if res.user_id and res.user:
            res.nickname = res.user.username[:20]
            res.save(update_fields=['nickname'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_gamesession_seed'),
    ]

    operations = [
        migrations.AddField(
            model_name='result',
            name='nickname',
            field=models.CharField(db_index=True, default='Anonymous', max_length=20),
        ),
        migrations.RunPython(backfill_result_nicknames, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='result',
            name='user',
        ),
        migrations.RemoveField(
            model_name='gamesession',
            name='user',
        ),
        migrations.AlterField(
            model_name='gamesession',
            name='started_at',
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name='gamesession',
            name='submitted_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
