"""Exercise the production research APIs against a fresh local SQLite database."""
import os
import sys
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'sermo-backend'))
os.environ['DJANGO_SETTINGS_MODULE']='Sermo.isolated_test_settings'
from django.conf import settings
settings.DATABASES['default']['NAME']=str(Path(tempfile.mkdtemp(prefix='frienden-research-review-'))/'db.sqlite3')
settings.ALLOWED_HOSTS=['127.0.0.1','localhost']
settings.INSTALLED_APPS=[*settings.INSTALLED_APPS,'django.contrib.sessions','corsheaders']
settings.MIDDLEWARE=['corsheaders.middleware.CorsMiddleware',*settings.MIDDLEWARE]
settings.CORS_ALLOWED_ORIGINS=['http://127.0.0.1:8804']
settings.CORS_ALLOW_HEADERS=['authorization','content-type','accept','accept-language']
import django
django.setup()
from django.core.management import call_command
call_command('migrate',verbosity=0)
from Space.models import Space
from User.models import User
from utils import auth
from Friendship.models import Friendship
from django.http import JsonResponse
from django.urls import path
from Sermo.urls import urlpatterns as real_urls
space=Space.objects.create(slug='research-review',name='本地科研验证',email='qa@example.invalid',research_enabled=True)
owner=space.ensure_official_user()
owner.name='本地导师'
owner.language='zh-CN'
owner.growth_acknowledged_level=18
owner.save()
student=User.create(space,'本地学生',verified=True)
# Reuse normal policy rather than bypassing research authorization.
from Friendship.models import FriendshipStatusChoice
Friendship.objects.get_or_create(space=space,user_low=owner,user_high=student,defaults=dict(status=FriendshipStatusChoice.ACCEPTED,requested_by=owner))
if os.environ.get('FRIENDEN_CHRONELLE_QA_FILE'):
    import json
    data=json.loads(Path(os.environ['FRIENDEN_CHRONELLE_QA_FILE']).read_text())
    os.environ.update(CHRONELLE_BINDING_CLIENT_ID=data['client_id'],CHRONELLE_BINDING_CLIENT_SECRET=data['client_secret'],CHRONELLE_BINDING_STORAGE_KEY=data['storage_key'])
    from User import chronelle_views,chronelle_account
    from User.models import ChronelleAccount
    from Chat.models import Chat,ChatMember,ResearchProject
    chronelle_views.APP_ORIGINS.add('http://127.0.0.1:8804')
    chronelle_views.BASE=chronelle_account.BASE='http://127.0.0.1:8035'
    for user,account in zip([owner,student],data['accounts']):
        row=ChronelleAccount.objects.create(user=user)
        chronelle_account.store(row,{**account,'access_until':__import__('time').time()+account['expires_in']})
    chat=Chat.objects.create(space=space,created_by=owner,chat_type=1,purpose=2,title='真实双服务本地联调')
    for user,role in [(owner,1),(student,0)]:ChatMember.objects.create(chat=chat,user=user,role=role,status=1)
    ResearchProject.objects.create(chat=chat,start='2026-10-27',calendar_policies={str(student.pk):{'detail':[],'busy':[data['accounts'][1]['group_id']]}})
def bootstrap(request):
    data=auth.get_login_token(owner)
    return JsonResponse(dict(accessToken=data['auth'],user=data['data']))
urlpatterns=[path('qa/session/',bootstrap),*real_urls]
settings.ROOT_URLCONF=__name__
call_command('runserver','127.0.0.1:8033',use_reloader=False)
