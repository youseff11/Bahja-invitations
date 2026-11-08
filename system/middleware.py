"""ميدل‑وير خاص بالمشروع."""

from django.conf import settings
from django.utils import translation


class DefaultLanguageMiddleware:
    """يخلي العربية هي الافتراضي مهما كانت لغة المتصفح.

    LocaleMiddleware بتاعة Django بترتّب المصادر كده:
        الجلسة ← الكوكي ← Accept-Language ← LANGUAGE_CODE
    يعني زبون مصري متصفحه إنجليزي كان هيفتح الموقع إنجليزي وهو عايز عربي.
    الميدل‑وير دي بتشيل Accept-Language من الطلب طالما المستخدم *ما اختارش*
    لغة بنفسه، فتفضل العربية هي الافتراضي وينزل الاختيار اليدوي فوق كل حاجة.

    لازم تتحط قبل django.middleware.locale.LocaleMiddleware في MIDDLEWARE.
    عايز تحترم لغة المتصفح بدل كده؟ شيلها من MIDDLEWARE وخلاص.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        session_key = getattr(settings, "LANGUAGE_SESSION_KEY", "_language")
        chosen = (
            (request.session.get(session_key) if hasattr(request, "session") else None)
            or request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME)
        )
        if not chosen:
            request.META.pop("HTTP_ACCEPT_LANGUAGE", None)
        return self.get_response(request)


class TranslationLockMiddleware:
    """لو الترجمة مقفولة من «إعدادات الموقع» الموقع كله بيفضل عربي.

    بتيجي بعد LocaleMiddleware وبتغلب اختيار الزائر (الجلسة/الكوكي) من غير
    ما تمسحه — فلو الترجمة اتفتحت تاني كل زائر يرجع للغة اللي كان مختارها.
    الملفات الثابتة مالهاش لغة، فبنعدّيها من غير استعلام.
    """

    SKIP = ("/static/", "/media/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith(self.SKIP):
            from .models import SiteSetting  # بدري على مستوى الملف = AppRegistryNotReady

            if not SiteSetting.load().translation_enabled:
                lang = settings.LANGUAGE_CODE
                translation.activate(lang)
                request.LANGUAGE_CODE = translation.get_language()
        return self.get_response(request)
