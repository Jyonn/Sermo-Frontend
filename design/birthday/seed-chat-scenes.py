"""Run with the isolated birthday preview settings, from the backend directory.

Never points at production: requires the explicit preview SQLite file under /private/tmp.
"""
from datetime import timedelta
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from Chat.models import Chat, ChatMember, ChatTypeChoice, ChatMemberRoleChoice, ChatMemberStatusChoice
from Friendship.models import Friendship, FriendshipStatusChoice
from Message.models import Message, MessageTypeChoice
from Space.models import Space
from User.models import User

database = settings.DATABASES['default']
assert database['ENGINE'] == 'django.db.backends.sqlite3'
assert Path(database['NAME']).resolve() == Path('/private/tmp/frienden-birthday-final-preview.sqlite3')
assert settings.DEBUG, 'Preview fixtures require DEBUG and the isolated database'
space = Space.objects.get(slug='birthday-preview')
me = User.objects.get(space=space, name='阿言')
members = [me]
for name in ['小满', '林间', '晚晴']:
    user = User.objects.filter(space=space, name=name).first() or User.create(space, name, verified=True)
    members.append(user)
    low, high = sorted([me.pk, user.pk])
    Friendship.objects.update_or_create(space=space, user_low_id=low, user_high_id=high, defaults={'status': FriendshipStatusChoice.ACCEPTED, 'requested_by': me})

scenes = [
    ('花间来日·私聊预览', ChatTypeChoice.DIRECT, members[:2], [
        (1, '生日快乐，阿言。今天想带你去看花。'),
        (0, '正好，天气也像是专门准备的。'),
        (1, '记得上次路过的那家花店吗？门口的洋甘菊开了。'),
        (0, '记得！我还拍了一张照片。'),
        (1, '下午三点见。今天的日程，留一点给喜欢的事情。'),
        (0, '那就慢慢走，不赶时间。🌿'),
    ]),
    ('花间来日·花园小聚', ChatTypeChoice.GROUP, members, [
        (1, '今天的第一声生日快乐，送给阿言！'),
        (2, '蛋糕已经订好了，少糖、很多草莓。'),
        (0, '谢谢你们，还记得我的口味。'),
        (3, '我带花来。愿新的一岁，每一天都有小小的好事。'),
        (1, '晚上去河边散步？可以带上相机。'),
        (0, '好呀，把今天认真收好。'),
    ]),
]
for title, kind, people, lines in scenes:
    chat, created = Chat.objects.get_or_create(space=space, title=title, chat_type=kind, defaults={'created_by': me})
    for index, person in enumerate(people):
        ChatMember.objects.update_or_create(chat=chat, user=person, defaults={'status': ChatMemberStatusChoice.ACTIVE, 'role': ChatMemberRoleChoice.OWNER if index == 0 else ChatMemberRoleChoice.MEMBER, 'joined_at': timezone.now()-timedelta(days=1)})
    if created:
        previous = None
        for index, (author, text) in enumerate(lines * 4):
            message = Message.objects.create(chat=chat, user=people[author], type=MessageTypeChoice.TEXT, content=text, reply_to=previous if index == 4 else None)
            Message.objects.filter(pk=message.pk).update(created_at=timezone.now()-timedelta(minutes=(len(lines)*4-index)*3))
            previous = message
    print(f'{title}: /birthday-preview/app/chats/{chat.pk}')
