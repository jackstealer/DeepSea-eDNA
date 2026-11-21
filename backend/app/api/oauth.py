"""
Google and GitHub sign-in (OAuth 2.0 authorization-code flow)

1. GET /auth/oauth/{provider}/login     -> redirects the browser to the provider
2. Provider redirects to /auth/oauth/{provider}/callback?code=...&state=...
3. The backend exchanges the code, reads the verified email, finds or creates the user,
   then redirects to FRONTEND_URL/oauth/callback#access_token=...&refresh_token=...
   (tokens travel in the URL fragment, which browsers never send to servers)
"""
import logging
import secrets
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_oauth_state, decode_token
from app.db.models import OAuthAccount, User
from app.db.session import get_db
from app.services.users import get_user_by_email, initial_role, issue_tokens, normalize_email, unique_username

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oauth", tags=["Authentication"])

STATE_COOKIE = "deepsea_oauth_state"
HTTP_TIMEOUT = 10.0


@dataclass
class ProviderConfig:
    authorize_url: str
    token_url: str
    scope: str
    client_id: str
    client_secret: str


@dataclass
class OAuthProfile:
    provider_user_id: str
    email: str  # verified
    full_name: str
    login_hint: str  # basis for a new username
    avatar_url: Optional[str] = None


class OAuthError(Exception):
    """A user-facing sign-in failure"""


def provider_config(provider: str) -> ProviderConfig:
    if provider == "google":
        cfg = ProviderConfig(
            "https://accounts.google.com/o/oauth2/v2/auth",
            "https://oauth2.googleapis.com/token",
            "openid email profile",
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_SECRET,
        )
    elif provider == "github":
        cfg = ProviderConfig(
            "https://github.com/login/oauth/authorize",
            "https://github.com/login/oauth/access_token",
            "read:user user:email",
            settings.GITHUB_CLIENT_ID,
            settings.GITHUB_CLIENT_SECRET,
        )
    else:
        raise HTTPException(status_code=404, detail="Unknown sign-in provider")
    if not (cfg.client_id and cfg.client_secret):
        raise HTTPException(status_code=404, detail=f"{provider.title()} sign-in is not configured")
    return cfg


def redirect_uri(provider: str) -> str:
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/auth/oauth/{provider}/callback"


def configured_redirect_uris() -> dict:
    """Callback URL each configured provider must list in its console (Google: Authorized redirect URIs)."""
    uris = {}
    for provider in ("google", "github"):
        try:
            provider_config(provider)
        except HTTPException:
            continue
        uris[provider] = redirect_uri(provider)
    return uris


def frontend_redirect(path: str, **params) -> RedirectResponse:
    return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}{path}{urlencode(params) if params else ''}")


# ==================== Provider API calls ====================

def exchange_code(provider: str, cfg: ProviderConfig, code: str) -> str:
    response = httpx.post(
        cfg.token_url,
        data={
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "code": code,
            "redirect_uri": redirect_uri(provider),
            "grant_type": "authorization_code",
        },
        headers={"Accept": "application/json"},
        timeout=HTTP_TIMEOUT,
    )
    token = response.json().get("access_token") if response.status_code == 200 else None
    if not token:
        logger.warning(f"{provider} token exchange failed: {response.status_code} {response.text[:200]}")
        raise OAuthError("Could not complete sign-in with the provider")
    return token


def fetch_google_profile(access_token: str) -> OAuthProfile:
    info = httpx.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=HTTP_TIMEOUT,
    ).json()
    if not info.get("email") or not info.get("email_verified"):
        raise OAuthError("Your Google account has no verified email address")
    return OAuthProfile(
        provider_user_id=str(info["sub"]),
        email=info["email"],
        full_name=info.get("name") or info["email"].split("@")[0],
        login_hint=info["email"].split("@")[0],
        avatar_url=info.get("picture"),
    )


def fetch_github_profile(access_token: str) -> OAuthProfile:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    user = httpx.get("https://api.github.com/user", headers=headers, timeout=HTTP_TIMEOUT).json()
    emails = httpx.get("https://api.github.com/user/emails", headers=headers, timeout=HTTP_TIMEOUT).json()
    verified = [e for e in emails if isinstance(e, dict) and e.get("verified")] if isinstance(emails, list) else []
    primary = next((e for e in verified if e.get("primary")), verified[0] if verified else None)
    if not primary:
        raise OAuthError("Your GitHub account has no verified email address")
    return OAuthProfile(
        provider_user_id=str(user["id"]),
        email=primary["email"],
        full_name=user.get("name") or user.get("login") or primary["email"].split("@")[0],
        login_hint=user.get("login") or primary["email"].split("@")[0],
        avatar_url=user.get("avatar_url"),
    )


PROFILE_FETCHERS = {"google": fetch_google_profile, "github": fetch_github_profile}


# ==================== Account resolution ====================

def find_or_create_user(db: Session, provider: str, profile: OAuthProfile) -> User:
    """Linked account -> existing user with the same verified email -> new viewer account"""
    account = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider, OAuthAccount.provider_user_id == profile.provider_user_id
        )
    )
    if account:
        user = account.user
    else:
        email = normalize_email(profile.email)
        user = get_user_by_email(db, email)
        if user is None:
            user = User(
                email=email,
                username=unique_username(db, profile.login_hint),
                full_name=profile.full_name,
                role=initial_role(email),
            )
            db.add(user)
            db.flush()
            logger.info(f"Created user {user.username} via {provider}")
        db.add(OAuthAccount(user_id=user.id, provider=provider, provider_user_id=profile.provider_user_id, email=email))

    if profile.avatar_url and not user.avatar_url:
        user.avatar_url = profile.avatar_url
    db.flush()
    return user


# ==================== Routes ====================

@router.get("/{provider}/login")
def oauth_login(provider: str):
    """Start sign-in: redirect the browser to the provider's consent screen"""
    cfg = provider_config(provider)
    nonce = secrets.token_urlsafe(24)
    params = {
        "client_id": cfg.client_id,
        "redirect_uri": redirect_uri(provider),
        "scope": cfg.scope,
        "state": create_oauth_state(provider, nonce),
        "response_type": "code",
    }
    if provider == "google":
        params["prompt"] = "select_account"
    response = RedirectResponse(f"{cfg.authorize_url}?{urlencode(params)}")
    # Binds the state to this browser so a forged callback link cannot log someone in
    response.set_cookie(
        STATE_COOKIE, nonce, max_age=600, httponly=True, samesite="lax",
        secure=settings.BACKEND_PUBLIC_URL.startswith("https"), path="/auth/oauth",
    )
    return response


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    cfg = provider_config(provider)
    try:
        if error:
            raise OAuthError("Sign-in was cancelled" if error == "access_denied" else f"Provider error: {error}")
        payload = decode_token(state or "", expected_type="oauth_state")
        cookie_nonce = request.cookies.get(STATE_COOKIE)
        if not payload or payload.get("provider") != provider or not cookie_nonce or payload["nonce"] != cookie_nonce:
            raise OAuthError("Sign-in session expired. Please try again.")
        if not code:
            raise OAuthError("Missing authorization code")

        profile = PROFILE_FETCHERS[provider](exchange_code(provider, cfg, code))
        user = find_or_create_user(db, provider, profile)
        if not user.is_active:
            db.commit()
            raise OAuthError("This account has been disabled")
        tokens = issue_tokens(db, user)
    except (OAuthError, httpx.HTTPError) as e:
        db.rollback()
        message = str(e) if isinstance(e, OAuthError) else "Could not reach the sign-in provider"
        response = frontend_redirect("/login?", oauth_error=message)
    else:
        response = frontend_redirect("/oauth/callback#", **tokens)
    response.delete_cookie(STATE_COOKIE, path="/auth/oauth")
    return response
