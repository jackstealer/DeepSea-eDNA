"""
The callback URL each configured sign-in provider must have registered. A mismatch with the
provider's console is what Google reports as "Error 400: redirect_uri_mismatch".
"""
from app.api.oauth import configured_redirect_uris
from app.core.config import settings


def test_lists_exactly_the_configured_providers_with_their_callback_urls():
    base = settings.BACKEND_PUBLIC_URL.rstrip("/")
    # conftest configures GitHub and blanks Google
    assert configured_redirect_uris() == {"github": f"{base}/auth/oauth/github/callback"}
