"""Two real services, temporary databases and synthetic accounts; never deploy."""
import hashlib,json,os,secrets,sys,tempfile
from datetime import timedelta
from pathlib import Path
from cryptography.fernet import Fernet
root=Path(__file__).resolve().parents[4]/'Calendar/chronelle-backend'
sys.path.insert(0,str(root))
os.environ.update(TESTING='1',DJANGO_DEBUG='1',DJANGO_SETTINGS_MODULE='config.settings',DATA_ENCRYPTION_KEY=Fernet.generate_key().decode())
from django.conf import settings
directory=Path(tempfile.mkdtemp(prefix='frienden-full-calendar-review-'))
settings.DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':str(directory/'db.sqlite3')}}
import django
django.setup()
from django.core.management import call_command
call_command('migrate',verbosity=0)
from django.contrib.auth import get_user_model,login
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from django.http import HttpResponse
from django.urls import path
from config.urls import urlpatterns as real_urls
from calendarapp.models import Calendar,Group,Event,ApplicationGrant
from calendarapp.events import build_payload
from calendar_extras.binding_models import BindingClient,CalendarBinding
from calendar_extras.binding_auth import credentials,subject_for
from calendar_extras.binding_policy import FULL_CALENDAR_V1
secret=secrets.token_urlsafe(48)
app=BindingClient.objects.create(name='Local integration test',app_url='https://app.example',redirect_uris=['http://127.0.0.1:8804/app/research'],display_origins=['http://127.0.0.1:8804'],enabled=True,secret_hash=make_password(secret))
accounts=[]
for index in range(2):
    user=get_user_model().objects.create_user('local-research-'+str(index),email='review'+str(index)+'@example.invalid')
    cal=Calendar.objects.create(owner=user)
    group=Group.objects.create(calendar=cal,name='本地联调类别组')
    today=timezone.localdate().isoformat()
    Event.objects.create(group=group,payload=build_payload({'title':'真实接口联调记录 '+str(index+1),'start':today+f'T{9+index:02}:00:00+08:00','end':today+f'T{10+index:02}:00:00+08:00','timezone':'Asia/Shanghai'}))
    expiry=timezone.now()+timedelta(days=1)
    grant=ApplicationGrant.objects.create(owner=user,app_name=app.name,app_url=app.app_url,token_digest=hashlib.sha256(os.urandom(32)).hexdigest(),scopes=list(FULL_CALENDAR_V1),all_groups=True,expires_at=expiry)
    binding=CalendarBinding.objects.create(client=app,subject=subject_for(user),grant=grant,client_epoch=app.epoch,expires_at=expiry)
    accounts.append({**credentials(binding),'group_id':group.pk,'user_id':user.pk})
file=directory/'handoff.json'
file.touch(mode=0o600)
file.write_text(json.dumps({'client_id':str(app.pk),'client_secret':secret,'storage_key':Fernet.generate_key().decode(),'accounts':accounts},default=str))
def qa_login(request):
    login(request,get_user_model().objects.get(pk=accounts[0]['user_id']),backend='django.contrib.auth.backends.ModelBackend')
    return HttpResponse('Isolated synthetic viewer session. No production account or consent was used.')
urlpatterns=[path('qa/login/',qa_login),*real_urls]
settings.ROOT_URLCONF=__name__
print('Private local handoff file:',file,flush=True)
call_command('runserver','127.0.0.1:8035',use_reloader=False)
