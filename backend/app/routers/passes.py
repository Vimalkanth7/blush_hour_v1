from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.passes import (
    PassCatalogProductRead,
    PassPurchaseValidationRequest,
    PassPurchaseValidationResponse,
    PassesCatalogResponse,
    PassesMeResponse,
)
from app.services.passes import (
    build_user_pass_wallet_read,
    ensure_passes_enabled,
    get_active_pass_catalog,
    get_or_create_user_pass_wallet,
    get_passes_platform,
    get_passes_provider_mode,
    validate_pass_purchase,
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
        wallet=build_user_pass_wallet_read(wallet),
    )


@router.post("/google/validate", response_model=PassPurchaseValidationResponse)
async def validate_google_pass_purchase(
    request_data: PassPurchaseValidationRequest,
    current_user: User = Depends(get_current_user),
):
    return await validate_pass_purchase(current_user=current_user, request_data=request_data)
