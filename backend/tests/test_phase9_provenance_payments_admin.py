import pytest
from httpx import AsyncClient
from sqlalchemy import select
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.subscription import Subscription, CreditLedger
from backend.app.services.credit_service import CreditService
from backend.tests.conftest import test_session_maker

async def create_test_track(title="Phase 9 Track", user_id=None) -> str:
    async with test_session_maker() as session:
        async with session.begin():
            if not user_id:
                u_res = await session.execute(select(User).limit(1))
                user = u_res.scalar_one()
                user_id = user.id
            t = Track(
                user_id=user_id,
                title=title,
                genre="Synthwave",
                duration_seconds=45.0,
                audio_url="/api/v1/storage/file/p9_synth.wav",
                is_public=True,
                visibility="public",
                moderation_status="approved",
            )
            session.add(t)
            await session.flush()
            return t.id

@pytest.mark.asyncio
class TestProvenanceRightsRegistry:
    """Verifies rights registry, commercial eligibility evaluation, and non-infringement disclaimers."""

    async def test_provenance_registry_and_statutory_disclaimer(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]
        track_id = await create_test_track(title="Neon Memory Stream", user_id=my_id)

        # 1. Fetch Provenance Registry Record
        res = await client.get(f"/api/v1/provenance/track/{track_id}")
        assert res.status_code == 200, res.text
        data = res.json()

        assert data["track_id"] == track_id
        assert data["model_provider"] == "fombo_procedural_dsp"
        assert data["model_version"] == "2.4.0"
        assert "c2pa_manifest" in data
        assert "output_audio_sha256" in data

        # Statutory Disclaimer Verification (Must NEVER promise copyright registration or non-infringement)
        disclaimer = data["legal_disclaimer"]
        assert "does NOT guarantee copyright registration" in disclaimer
        assert "immunity from third-party infringement claims" in disclaimer

    async def test_commercial_use_eligibility_and_source_asset_declarations(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]
        track_id = await create_test_track(title="Sampled Resonance", user_id=my_id)

        # Initially eligible with default procedural synth
        res1 = await client.get(f"/api/v1/provenance/track/{track_id}")
        assert res1.status_code == 200
        assert res1.json()["commercial_use_eligibility"] == "eligible"

        # 1. Register a user-supplied asset with NON-COMMERCIAL restriction
        decl_payload_nc = {
            "asset_id": "asset_sample_vocal_001",
            "clearance_type": "non_commercial",
            "rights_holder_name": "Indie Singer",
            "attestation_statement": "Uploaded vocal sample licensed under CC BY-NC 4.0 only.",
            "commercial_allowed": False,
        }
        res2 = await client.post(
            f"/api/v1/provenance/track/{track_id}/rights-declaration",
            json=decl_payload_nc,
            headers=auth_headers,
        )
        assert res2.status_code == 200, res2.text
        data2 = res2.json()
        assert data2["commercial_use_eligibility"] == "restricted"
        assert any("non-commercial limitation" in r for r in data2["commercial_eligibility_reasons"])

        # 2. Update declaration to fully cleared original composition
        decl_payload_cleared = {
            "asset_id": "asset_sample_vocal_001",
            "clearance_type": "original_composition",
            "rights_holder_name": "Myself (Authenticated Creator)",
            "attestation_statement": "I attest under penalty of perjury that I created and own 100% of this vocal recording.",
            "commercial_allowed": True,
        }
        res3 = await client.post(
            f"/api/v1/provenance/track/{track_id}/rights-declaration",
            json=decl_payload_cleared,
            headers=auth_headers,
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["commercial_use_eligibility"] == "eligible"

    async def test_provenance_certificate_issuance(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]
        track_id = await create_test_track(title="Signed Masterpiece", user_id=my_id)

        cert_res = await client.get(f"/api/v1/provenance/track/{track_id}/certificate")
        assert cert_res.status_code == 200, cert_res.text
        cert_data = cert_res.json()

        assert cert_data["certificate_id"].startswith("CERT-")
        assert cert_data["track_id"] == track_id
        assert len(cert_data["sha256_digest"]) == 64
        assert "statutory_disclaimer" in cert_data

@pytest.mark.asyncio
class TestCreditLedgerAndDoubleChargePrevention:
    """Verifies transactional reservations, consumptions, refunds, and double-charge prevention."""

    async def test_credit_ledger_reservation_consumption_and_refund(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        # Ensure user has 100 credits
        async with test_session_maker() as session:
            async with session.begin():
                u = (await session.execute(select(User).where(User.id == my_id))).scalar_one()
                u.credits_balance = 100

        job_id = "test_job_stem_sep_101"

        # 1. Reserve 15 credits
        async with test_session_maker() as session:
            reservation = await CreditService.reserve_credits(
                db=session,
                user_id=my_id,
                amount=15,
                reference_id=job_id,
                idempotency_key=f"idem_res_{job_id}",
                notes="Stem separation test reservation",
            )
            assert reservation.amount == -15
            assert reservation.balance_after == 85
            assert reservation.status == "reserved"

        # Check balance endpoint
        bal_res = await client.get("/api/v1/subscriptions/balance", headers=auth_headers)
        assert bal_res.status_code == 200
        assert bal_res.json()["credits_balance"] == 85
        assert bal_res.json()["reserved_credits"] == 15

        # 2. Commit credits on job success
        async with test_session_maker() as session:
            committed = await CreditService.commit_credits(db=session, reference_id=job_id)
            assert committed is not None
            assert committed.status == "consumed"

        # 3. Simulate job failure with refund
        fail_job_id = "test_job_failed_inference_202"
        async with test_session_maker() as session:
            await CreditService.reserve_credits(
                db=session,
                user_id=my_id,
                amount=20,
                reference_id=fail_job_id,
                idempotency_key=f"idem_fail_{fail_job_id}",
            )
            # Refund on eligible failure
            refund = await CreditService.refund_credits(
                db=session,
                reference_id=fail_job_id,
                reason="GPU timeout in worker node",
            )
            assert refund is not None
            assert refund.amount == 20
            assert refund.status == "refunded"
            assert refund.balance_after == 85

    async def test_double_charge_prevention_via_idempotency(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        job_id = "test_double_charge_check_303"
        idem_key = "idempotency_key_test_dc_303"

        # First reservation: deducts 10 credits
        async with test_session_maker() as session:
            first_entry = await CreditService.reserve_credits(
                db=session,
                user_id=my_id,
                amount=10,
                reference_id=job_id,
                idempotency_key=idem_key,
            )
            initial_balance = first_entry.balance_after

        # Second reservation with SAME idempotency key (network retry simulation)
        async with test_session_maker() as session:
            second_entry = await CreditService.reserve_credits(
                db=session,
                user_id=my_id,
                amount=10,
                reference_id=job_id,
                idempotency_key=idem_key,
            )
            # Must return the SAME entry and NOT double-deduct
            assert second_entry.id == first_entry.id
            assert second_entry.balance_after == initial_balance

        # Verify in DB balance wasn't decremented again
        async with test_session_maker() as session:
            u = (await session.execute(select(User).where(User.id == my_id))).scalar_one()
            assert u.credits_balance == initial_balance

@pytest.mark.asyncio
class TestStripeAndRazorpaySubscriptions:
    """Verifies webhook signature verification, entitlement checks, idempotency, and cancellation."""

    async def test_stripe_webhook_and_idempotency(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        event_id = "evt_test_stripe_unique_101"
        webhook_payload = {
            "id": event_id,
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": my_id,
                    "customer": "cus_test_12345",
                    "subscription": "sub_test_stripe_pro",
                    "payment_intent": "pi_test_stripe_pro",
                    "metadata": {"tier": "pro", "user_id": my_id},
                }
            },
        }

        # 1. Send first webhook with test signature
        res1 = await client.post(
            "/api/v1/payments/stripe/webhook",
            json=webhook_payload,
            headers={"stripe-signature": "fombo_test_signature"},
        )
        assert res1.status_code == 200, res1.text
        assert res1.json()["status"] == "success"

        # Verify user upgraded to pro_producer
        async with test_session_maker() as session:
            u = (await session.execute(select(User).where(User.id == my_id))).scalar_one()
            assert u.role == "pro_producer"
            bal_after_first = u.credits_balance

        # 2. Send DUPLICATE webhook event (Replay protection / Idempotency test)
        res2 = await client.post(
            "/api/v1/payments/stripe/webhook",
            json=webhook_payload,
            headers={"stripe-signature": "fombo_test_signature"},
        )
        assert res2.status_code == 200
        assert res2.json()["status"] == "already_processed"

        # Verify user credits balance was NOT double-credited
        async with test_session_maker() as session:
            u2 = (await session.execute(select(User).where(User.id == my_id))).scalar_one()
            assert u2.credits_balance == bal_after_first

    async def test_razorpay_order_and_signature_verification(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Create Order
        order_res = await client.post(
            "/api/v1/payments/razorpay/create-order",
            json={"tier": "studio", "currency": "INR"},
            headers=auth_headers,
        )
        assert order_res.status_code == 200, order_res.text
        order_data = order_res.json()
        assert order_data["order_id"].startswith("order_rzp_")
        assert order_data["amount_paise"] == 280000

        # 2. Verify Client-side Payment Signature
        verify_payload = {
            "razorpay_order_id": order_data["order_id"],
            "razorpay_payment_id": "pay_test_rzp_555",
            "razorpay_signature": "fombo_test_razorpay_signature",
            "tier": "studio",
        }
        v_res = await client.post(
            "/api/v1/payments/razorpay/verify-payment",
            json=verify_payload,
            headers=auth_headers,
        )
        assert v_res.status_code == 200, v_res.text
        assert "STUDIO plan activated" in v_res.json()["message"]

        # 3. Check Receipts
        rec_res = await client.get("/api/v1/payments/receipts", headers=auth_headers)
        assert rec_res.status_code == 200
        receipts = rec_res.json()["items"]
        assert any(r["provider"] == "razorpay" for r in receipts)

    async def test_subscription_cancellation_and_status(
        self, client: AsyncClient, auth_headers: dict
    ):
        cancel_res = await client.post(
            "/api/v1/payments/subscription/cancel",
            json={"immediate": False, "reason": "Testing period end cancellation"},
            headers=auth_headers,
        )
        assert cancel_res.status_code == 200, cancel_res.text
        assert "scheduled for cancellation" in cancel_res.json()["message"]

@pytest.mark.asyncio
class TestAdminDashboardsAndAccessControl:
    """Verifies admin access-control boundaries (403 for creators) and dashboard metrics for admins."""

    async def test_admin_access_control_boundaries(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Demote user to ordinary creator role
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        async with test_session_maker() as session:
            async with session.begin():
                u = (await session.execute(select(User).where(User.id == my_id))).scalar_one()
                u.role = "creator"

        admin_endpoints = [
            "/api/v1/admin/jobs",
            "/api/v1/admin/gpu-costs",
            "/api/v1/admin/moderation",
            "/api/v1/admin/payments",
            "/api/v1/admin/license-issues",
            "/api/v1/admin/audit-logs",
        ]

        # All admin endpoints MUST return 403 Forbidden for non-admin callers
        for ep in admin_endpoints:
            res = await client.get(ep, headers=auth_headers)
            assert res.status_code == 403, f"Endpoint {ep} should be 403 Forbidden for standard user, got {res.status_code}"

    async def test_admin_dashboards_payloads(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        # Elevate user to admin
        async with test_session_maker() as session:
            async with session.begin():
                u = (await session.execute(select(User).where(User.id == my_id))).scalar_one()
                u.role = "admin"

        # 1. Jobs Dashboard
        jobs_res = await client.get("/api/v1/admin/jobs", headers=auth_headers)
        assert jobs_res.status_code == 200, jobs_res.text
        jobs_data = jobs_res.json()
        assert "summary" in jobs_data
        assert "success_rate_percent" in jobs_data["summary"]

        # 2. GPU Costs Dashboard
        gpu_res = await client.get("/api/v1/admin/gpu-costs", headers=auth_headers)
        assert gpu_res.status_code == 200, gpu_res.text
        gpu_data = gpu_res.json()
        assert "total_estimated_cost_usd" in gpu_data
        assert "NVIDIA A10G (24GB)" in gpu_data["hardware_breakdown"]
        assert "NVIDIA T4 (16GB)" in gpu_data["hardware_breakdown"]

        # 3. Moderation Dashboard
        mod_res = await client.get("/api/v1/admin/moderation", headers=auth_headers)
        assert mod_res.status_code == 200, mod_res.text
        mod_data = mod_res.json()
        assert "summary" in mod_data
        assert "copyright_claims" in mod_data

        # 4. Payments Dashboard
        pay_res = await client.get("/api/v1/admin/payments", headers=auth_headers)
        assert pay_res.status_code == 200, pay_res.text
        pay_data = pay_res.json()
        assert "financial_summary" in pay_data
        assert "mrr_usd" in pay_data["financial_summary"]
        assert "arr_usd" in pay_data["financial_summary"]

        # 5. License Issues Dashboard
        lic_res = await client.get("/api/v1/admin/license-issues", headers=auth_headers)
        assert lic_res.status_code == 200, lic_res.text
        assert "restricted_tracks_count" in lic_res.json()

        # 6. Audit Logs Dashboard
        audit_res = await client.get("/api/v1/admin/audit-logs", headers=auth_headers)
        assert audit_res.status_code == 200, audit_res.text
        assert isinstance(audit_res.json(), list)
