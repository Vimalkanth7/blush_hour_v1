from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.passes import (
    PassCatalogProductRead,
    PassesCatalogResponse,
    PassesMeResponse,
    UserPassWalletRead,
)
from app.services.passes import (
    ensure_passes_enabled,
    get_active_pass_catalog,
    get_or_create_user_pass_wallet,
    get_passes_platform,
    get_passes_provider_mode,
)

router = APIRouter()


@router.get("/catalog", response_model=PassesCatalogResponse)
async def get_passes_catalog(_current_user: User = Depends(get_current_user)):
    ensure_passes_enabled()
    platform = get_passes_platform()
    products = get_active_pass_catalog(platform)
    return PassesCatalogResponse(
        provider_mode=get_passes_provider_mode(),
        platform=platform,
        products=[PassCatalogProductRead(**product) for product in products],
    )


@router.get("/me", response_model=PassesMeResponse)
async def get_my_passes(current_user: User = Depends(get_current_user)):
    ensure_passes_enabled()
    wallet = await get_or_create_user_pass_wallet(str(current_user.id))
    return PassesMeResponse(
        provider_mode=get_passes_provider_mode(),
        catalog_available=len(get_active_pass_catalog()) > 0,
        wallet=UserPassWalletRead(
            user_id=wallet.user_id,
            paid_pass_credits=wallet.paid_pass_credits,
            created_at=wallet.created_at,
            updated_at=wallet.updated_at,
        ),
    )
