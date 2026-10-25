import pytest
from httpx import AsyncClient
from sqlalchemy import select
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.tests.conftest import test_session_maker

async def create_test_track(title="Test Song", is_public=True, visibility="public", user_id=None) -> str:
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
                duration_seconds=30.0,
                audio_url="/api/v1/storage/file/synth.wav",
                is_public=is_public,
                visibility=visibility,
                moderation_status="approved",
            )
            session.add(t)
            await session.flush()
            return t.id

@pytest.mark.asyncio
class TestContentVisibilityAndPublishing:
    """Verifies private, unlisted, and public content visibility rules and publishing permissions."""

    async def test_publishing_permissions_and_distribution_disclaimer(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        # 1. Create a track
        track_id = await create_test_track(title="Draft Scratch Lead", is_public=False, visibility="private", user_id=my_id)

        # 2. Publish track with public visibility
        publish_payload = {
            "visibility": "public",
            "title": "Neon Skyline 2099",
            "description": "Retro futuristic analog lead synth",
            "genre": "Synthwave",
            "hashtags": ["#synthwave", "#cyberpunk", "#fombo"],
            "lyrics": "[Instrumental Intro]\n(Arpeggiated bassline)",
            "cover_image_url": "https://storage.fombo.ai/covers/neon.jpg",
            "bpm": 128,
            "musical_key": "F# Minor",
        }
        pub_res = await client.post(
            f"/api/v1/tracks/{track_id}/publish",
            json=publish_payload,
            headers=auth_headers,
        )
        assert pub_res.status_code == 200, pub_res.text
        data = pub_res.json()
        assert data["track"]["visibility"] == "public"
        assert data["track"]["is_public"] is True
        assert data["track"]["hashtags"] == ["#synthwave", "#cyberpunk", "#fombo"]

        # 3. Verify Truth in Distribution Disclosure
        disclaimer = data["distribution_notice"]
        assert "Spotify" in disclaimer
        assert "Apple Music" in disclaimer
        assert "not automatically" in disclaimer.lower() or "does not automatically" in disclaimer.lower()

    async def test_private_content_access_enforcement(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        # 1. Create a private track owned by current user
        track_id = await create_test_track(title="Private Studio Session", is_public=False, visibility="private", user_id=my_id)

        # 2. Owner can view track
        owner_res = await client.get(f"/api/v1/tracks/{track_id}", headers=auth_headers)
        assert owner_res.status_code == 200
        assert owner_res.json()["visibility"] == "private"

        # 3. Anonymous visitor blocked from viewing private track
        anon_res = await client.get(f"/api/v1/tracks/{track_id}")
        assert anon_res.status_code in (403, 404)

        # 4. Anonymous visitor blocked from streaming private track
        anon_stream = await client.get(f"/api/v1/tracks/{track_id}/stream")
        assert anon_stream.status_code in (403, 404)

    async def test_unlisted_content_access_rule(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Create unlisted track
        track_id = await create_test_track(title="Secret VIP Dubplate", is_public=False, visibility="unlisted")

        # Direct view via ID allowed for visitors
        direct_res = await client.get(f"/api/v1/tracks/{track_id}")
        assert direct_res.status_code == 200
        assert direct_res.json()["visibility"] == "unlisted"

        # But unlisted tracks are strictly excluded from public search
        search_res = await client.get("/api/v1/search?q=Secret+VIP+Dubplate")
        assert search_res.status_code == 200
        found_ids = [t["id"] for t in search_res.json()["items"]]
        assert track_id not in found_ids

    async def test_share_track_count_increment(
        self, client: AsyncClient, auth_headers: dict
    ):
        track_id = await create_test_track(title="Viral Summer Anthem", is_public=True, visibility="public")

        share_res = await client.post(f"/api/v1/tracks/{track_id}/share")
        assert share_res.status_code == 200
        data = share_res.json()
        assert data["share_count"] >= 1
        assert data["share_url"] == f"/song/{track_id}"


@pytest.mark.asyncio
class TestPlaylistOperations:
    """Verifies playlist lifecycle, privacy enforcement, adding/removing tracks, and reordering."""

    async def test_playlist_lifecycle_and_reordering(
        self, client: AsyncClient, auth_headers: dict
    ):
        # 1. Create Playlist
        pl_payload = {
            "title": "Midnight Chill Sessions",
            "description": "Smooth ambient synth and chillhop",
            "cover_image_url": "https://storage.fombo.ai/covers/chill.jpg",
            "is_public": True,
        }
        create_pl = await client.post("/api/v1/playlists", json=pl_payload, headers=auth_headers)
        assert create_pl.status_code == 201
        playlist = create_pl.json()
        playlist_id = playlist["id"]
        assert playlist["title"] == "Midnight Chill Sessions"

        # 2. Generate 2 tracks
        track1_id = await create_test_track(title="Chill Take 1")
        track2_id = await create_test_track(title="Chill Take 2")

        # 3. Add tracks to playlist
        add1 = await client.post(f"/api/v1/playlists/{playlist_id}/tracks", json={"track_id": track1_id, "position": 0}, headers=auth_headers)
        assert add1.status_code == 200
        add2 = await client.post(f"/api/v1/playlists/{playlist_id}/tracks", json={"track_id": track2_id, "position": 1}, headers=auth_headers)
        assert add2.status_code == 200

        # Verify track count updated
        get_pl = await client.get(f"/api/v1/playlists/{playlist_id}")
        assert get_pl.status_code == 200
        assert get_pl.json()["track_count"] == 2

        # 4. Reorder tracks
        reorder_res = await client.put(
            f"/api/v1/playlists/{playlist_id}/reorder",
            json={"track_ids": [track2_id, track1_id]},
            headers=auth_headers,
        )
        assert reorder_res.status_code == 200

        # 5. Remove track from playlist
        rem_res = await client.delete(f"/api/v1/playlists/{playlist_id}/tracks/{track1_id}", headers=auth_headers)
        assert rem_res.status_code == 200

        get_pl2 = await client.get(f"/api/v1/playlists/{playlist_id}")
        assert get_pl2.json()["track_count"] == 1

        # 6. Delete Playlist
        del_pl = await client.delete(f"/api/v1/playlists/{playlist_id}", headers=auth_headers)
        assert del_pl.status_code == 204

    async def test_private_playlist_privacy_enforcement(
        self, client: AsyncClient, auth_headers: dict
    ):
        create_pl = await client.post(
            "/api/v1/playlists",
            json={"title": "Private Scratch Ideas", "is_public": False},
            headers=auth_headers,
        )
        playlist_id = create_pl.json()["id"]

        # Owner can view
        owner_res = await client.get(f"/api/v1/playlists/{playlist_id}", headers=auth_headers)
        assert owner_res.status_code == 200

        # Anonymous visitor blocked
        anon_res = await client.get(f"/api/v1/playlists/{playlist_id}")
        assert anon_res.status_code == 403


@pytest.mark.asyncio
class TestModerationAndCopyrightTakedownWorkflow:
    """Verifies DMCA complaint filing, admin takedown, content quarantine, and reinstatement."""

    async def test_copyright_claim_and_takedown_workflow(
        self, client: AsyncClient, auth_headers: dict
    ):
        me_res = await client.get("/api/v1/profiles/me", headers=auth_headers)
        my_id = me_res.json()["user_id"]

        # 1. Create track owned by current user
        track_id = await create_test_track(title="Original Composed Synth", is_public=True, visibility="public", user_id=my_id)

        # 2. Submit formal DMCA copyright complaint
        claim_payload = {
            "claimant_name": "Universal Rights Group Legal",
            "claimant_email": "dmca@universalrights.com",
            "company_or_organization": "Universal Rights LLC",
            "work_infringed_title": "Neon Horizon (Original Composition)",
            "infringing_track_id": track_id,
            "good_faith_attestation": True,
            "accuracy_attestation": True,
            "signature": "Alice Walker, Esq.",
        }
        claim_res = await client.post("/api/v1/reports/copyright-claim", json=claim_payload)
        assert claim_res.status_code == 201, claim_res.text
        claim_id = claim_res.json()["id"]

        # Elevate user to admin in DB so they have permission to execute takedown
        async with test_session_maker() as session:
            async with session.begin():
                u = await session.get(User, my_id)
                u.role = "admin"

        # 3. Admin executes takedown
        takedown_res = await client.post(
            f"/api/v1/reports/claims/{claim_id}/takedown",
            headers=auth_headers,
        )
        assert takedown_res.status_code == 200
        assert takedown_res.json()["status"] == "taken_down"

        # 4. Verify Content Visibility Enforcement: Taken-down track is quarantined!
        anon_view = await client.get(f"/api/v1/tracks/{track_id}")
        assert anon_view.status_code in (403, 404)

        anon_stream = await client.get(f"/api/v1/tracks/{track_id}/stream")
        assert anon_stream.status_code in (403, 404)

        # Excluded from search
        search_res = await client.get("/api/v1/search?q=Original+Composed+Synth")
        found = [t["id"] for t in search_res.json()["items"]]
        assert track_id not in found

        # 5. Check that Creator received compliance Notification
        notif_res = await client.get("/api/v1/notifications", headers=auth_headers)
        assert notif_res.status_code == 200
        notifications = notif_res.json()["notifications"]
        assert any(n["type"] == "takedown" for n in notifications)

        # 6. Reinstate track after resolution
        reinstate_res = await client.post(
            f"/api/v1/reports/claims/{claim_id}/reinstate",
            headers=auth_headers,
        )
        assert reinstate_res.status_code == 200
        assert reinstate_res.json()["status"] == "reinstated"

        # Check track is restored
        track_restored = await client.get(f"/api/v1/tracks/{track_id}", headers=auth_headers)
        assert track_restored.status_code == 200
        assert track_restored.json()["moderation_status"] == "approved"


@pytest.mark.asyncio
class TestListeningAnalyticsWithBotProtection:
    """Verifies duration gating, bot/crawler rejection, and rate limit debouncing."""

    async def test_bot_user_agent_rejected(self, client: AsyncClient, auth_headers: dict):
        track_id = await create_test_track(title="Bot Defense Test Track")

        res = await client.post(
            "/api/v1/analytics/play",
            json={"track_id": track_id, "duration_listened_seconds": 35.0},
            headers={"User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["counted"] is False
        assert data["rejection_reason"] == "bot_user_agent"

    async def test_short_duration_listen_rejected(self, client: AsyncClient, auth_headers: dict):
        track_id = await create_test_track(title="Short Listen Test Track")

        res = await client.post(
            "/api/v1/analytics/play",
            json={"track_id": track_id, "duration_listened_seconds": 8.0},
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["counted"] is False
        assert data["rejection_reason"] == "short_listen_duration"

    async def test_genuine_listen_counted_and_rapid_replay_debounced(
        self, client: AsyncClient, auth_headers: dict
    ):
        track_id = await create_test_track(title="Genuine Play Test Track")

        # 1. First genuine listen (>= 15s) with browser user-agent
        res1 = await client.post(
            "/api/v1/analytics/play",
            json={"track_id": track_id, "duration_listened_seconds": 25.0},
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"},
        )
        assert res1.status_code == 200
        assert res1.json()["counted"] is True
        assert res1.json()["play_count"] >= 1

        # 2. Second rapid replay within 60s from same IP is debounced!
        res2 = await client.post(
            "/api/v1/analytics/play",
            json={"track_id": track_id, "duration_listened_seconds": 25.0},
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"},
        )
        assert res2.status_code == 200
        assert res2.json()["counted"] is False
        assert res2.json()["rejection_reason"] == "duplicate_recent_play"
