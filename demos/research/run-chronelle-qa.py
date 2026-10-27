"""Isolated local Chronelle fixture server; no production state or credentials."""
import hashlib
import json
import os
import sys
import tempfile
import runpy
from datetime import timedelta
from pathlib import Path

# Sermo and Calendar are sibling application directories.
root = Path(__file__).resolve().parents[4] / 'Calendar' / 'chronelle-backend'
sys.path.insert(0, str(root))
os.environ.update(TESTING='1', DJANGO_DEBUG='1', DJANGO_SETTINGS_MODULE='config.settings',
                  CSRF_TRUSTED_ORIGINS='http://127.0.0.1:8031',
                  CHRONELLE_PUBLIC_URL='http://127.0.0.1:8031')
from django.conf import settings
directory = Path(tempfile.mkdtemp(prefix='frienden-chronelle-qa-'))
settings.DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': str(directory / 'qa.sqlite3')}}
import django
django.setup()
from calendar_extras import binding_display
prepared = runpy.run_path(str(Path(__file__).with_name('prepare-chronelle-assets.py')))['prepare']()
binding_display.__file__ = str(prepared / 'binding_display.py')
from django.http import HttpResponse
from django.urls import path
from config.urls import urlpatterns as chronelle_urls

def qa_login(request):
    # Test bootstrap only: this fresh database contains synthetic accounts only.
    # This does not exercise production login/consent or issue binding tokens.
    if request.path == '/qa-session/':
        from django.contrib.auth import get_user_model, login
        user = get_user_model().objects.get(username='frienden-local-qa')
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        return HttpResponse('Synthetic viewer session ready. No production authentication was exercised.')
    return HttpResponse('<h1>Isolated Chronelle QA</h1><p>Synthetic accounts only. This fixture does not test production login or consent.</p><a href="/qa-session/">Start synthetic viewer session</a>')

urlpatterns = [path('', qa_login), path('qa-session/', qa_login), *chronelle_urls]
settings.ROOT_URLCONF = __name__
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from calendarapp.models import Calendar, Group, Event, ApplicationGrant, VerifiedEmail
from calendarapp.events import build_payload
from calendar_extras.models import AccountEmail
from calendar_extras.binding_models import BindingClient, CalendarBinding, BindingDisplay
from calendar_extras.binding_auth import subject_for
from calendar_extras.binding_policy import FULL_CALENDAR_V1

call_command('migrate', verbosity=0)
viewer = get_user_model().objects.create_user(username='frienden-local-qa', email='frienden-qa@example.invalid', first_name='本地导师')
VerifiedEmail.objects.create(user=viewer, email=viewer.email, verified_at=timezone.now())
AccountEmail.objects.create(owner=viewer, email=viewer.email, verified_at=timezone.now())
Calendar.objects.create(owner=viewer)
app = BindingClient.objects.create(name='Frienden local QA', app_url='https://app.example', redirect_uris=['https://app.example/callback'], display_origins=['http://127.0.0.1:8802'], secret_hash=make_password('not-a-real-client-secret'), enabled=True)
ids = []
for index in range(4):
    owner = viewer if index == 0 else get_user_model().objects.create_user(username=f'frienden-fixture-{index}')
    calendar, _ = Calendar.objects.get_or_create(owner=owner)
    group = Group.objects.create(calendar=calendar, name='本地课题')
    start = ['09:00', '09:30', '14:00', '15:00'][index]
    end = ['10:30', '11:00', '15:00', '16:00'][index]
    Event.objects.create(group=group, payload=build_payload({'title': ['文献阅读', '方法讨论', '实验复核', '论文写作'][index], 'start': f'2026-10-29T{start}:00+08:00', 'end': f'2026-10-29T{end}:00+08:00', 'timezone': 'Asia/Shanghai', 'description': '独立本地测试数据'}))
    expiry = timezone.now() + timedelta(minutes=15)
    grant = ApplicationGrant.objects.create(owner=owner, app_name=app.name, app_url=app.app_url, token_digest=hashlib.sha256(os.urandom(32)).hexdigest(), scopes=list(FULL_CALENDAR_V1), all_groups=True, expires_at=expiry)
    binding = CalendarBinding.objects.create(client=app, subject=subject_for(owner), grant=grant, client_epoch=app.epoch, expires_at=expiry)
    display = BindingDisplay.objects.create(binding=binding, viewer=subject_for(viewer), calendar=calendar, detail_groups=[group.pk], busy_groups=[], purpose='frienden-local-qa', origins=['http://127.0.0.1:8802'], expires_at=expiry)
    ids.append(f'http://127.0.0.1:8031/binding-embed/{display.pk}/')
print(json.dumps({'display_urls': ids, 'fixture_directory': str(directory)}, ensure_ascii=False), flush=True)
call_command('runserver', '127.0.0.1:8031', use_reloader=False)
