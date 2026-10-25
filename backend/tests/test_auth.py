import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # 1. Register
    reg_payload = {
        "email": "beatmaker@fombo.ai",
        "username": "beatmaker",
        "password": "SecretPassword123!",
        "full_name": "Beat Maker"
    }
    res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "beatmaker@fombo.ai"
    assert data["user"]["credits_balance"] == 50

    # 2. Duplicate registration should fail
    dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 409

    # 3. Login with correct password
    login_payload = {
        "email": "beatmaker@fombo.ai",
        "password": "SecretPassword123!"
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]

    # 4. Access /auth/me with Bearer token
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "beatmaker"

@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    login_payload = {
        "email": "nonexistent@fombo.ai",
        "password": "WrongPassword!"
    }
    res = await client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 401
