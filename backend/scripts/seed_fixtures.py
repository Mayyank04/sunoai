import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from backend.app.core.database import async_session_maker, init_db
from backend.app.core.security import get_password_hash
from backend.app.models.user import User
from backend.app.models.profile import Profile
from backend.app.models.subscription import Subscription, CreditLedger
from backend.app.models.track import Track
from backend.app.models.stem import Stem
from backend.app.models.social import Artist, Like, Comment
from backend.app.models.playlist import Playlist, PlaylistTrack
from backend.app.models.license import License
from backend.app.models.provenance import Provenance
from backend.app.models.daw_project import DawProject

async def seed():
    print("🌱 Initializing database schema...")
    await init_db()

    async with async_session_maker() as db:
        print("🌱 Seeding user accounts & profiles...")
        # Check if already seeded
        res = await db.execute(select(User).where(User.username == "demo_creator"))
        if res.scalar_one_or_none():
            print("✨ Fixtures already seeded in database.")
            return

        # 1. Users
        creator = User(
            email="demo@fombo.ai",
            username="demo_creator",
            full_name="Alex River",
            hashed_password=get_password_hash("Password123!"),
            role="creator",
            credits_balance=100,
            is_verified=True,
        )
        pro_user = User(
            email="pro@fombo.ai",
            username="pro_producer",
            full_name="Maya Lin (Pro)",
            hashed_password=get_password_hash("Password123!"),
            role="pro_producer",
            credits_balance=500,
            is_verified=True,
        )
        admin_user = User(
            email="admin@fombo.ai",
            username="admin_user",
            full_name="Fombo System Admin",
            hashed_password=get_password_hash("Password123!"),
            role="admin",
            credits_balance=9999,
            is_verified=True,
        )
        db.add_all([creator, pro_user, admin_user])
        await db.flush()

        # 2. Profiles
        creator_profile = Profile(
            user_id=creator.id,
            display_name="Alex River",
            bio="Electronic & ambient synth sound designer. Exploring generative algorithmic audio.",
            website="https://alexriver.audio",
            social_links={"twitter": "@alexriver_synth", "soundcloud": "alexriver"},
            preferences={"sample_rate": 44100, "buffer_size": 1024, "limiter_ceiling": -0.3},
            stats={"total_plays": 4820, "followers_count": 215, "total_tracks": 4},
        )
        pro_profile = Profile(
            user_id=pro_user.id,
            display_name="Maya Lin",
            bio="Multi-platinum audio engineer & electronic music producer. DAW power user.",
            preferences={"sample_rate": 48000, "buffer_size": 512, "limiter_ceiling": -0.1},
            stats={"total_plays": 38400, "followers_count": 1420, "total_tracks": 18},
        )
        db.add_all([creator_profile, pro_profile])

        # 3. Subscriptions & Credits
        sub = Subscription(
            user_id=pro_user.id,
            tier="pro",
            status="active",
            monthly_credit_allowance=500,
            current_period_start=datetime.now(timezone.utc),
            current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
            stripe_customer_id="cus_test_fombo_pro",
            stripe_subscription_id="sub_test_fombo_pro_monthly",
        )
        credit_entry = CreditLedger(
            user_id=pro_user.id,
            amount=500,
            balance_after=500,
            transaction_type="monthly_renewal",
            notes="Pro subscription monthly credit allocation",
        )
        db.add_all([sub, credit_entry])

        # 4. Artists
        artist = Artist(
            user_id=creator.id,
            name="Cybernetic Echoes",
            bio="Retro-futuristic analog synth collective based in Tokyo.",
            genre="Synthwave / Cyberpunk",
            verified=True,
            monthly_listeners=12400,
        )
        db.add(artist)

        # 5. Tracks
        track1 = Track(
            user_id=creator.id,
            title="Neon Horizon 2099",
            description="Punchy retro analog synthesizers layered with deep 808 sub-bass and gated reverb drums.",
            genre="Synthwave",
            style_tags=["synthwave", "analog", "80s", "neon", "sub-bass"],
            mood="Energetic",
            bpm=124,
            musical_key="F# Minor",
            duration_seconds=145.0,
            audio_url="/api/v1/storage/file/tracks/demo_track_1.wav",
            waveform_data=[15, 25, 45, 75, 90, 85, 70, 60, 50, 65, 80, 95, 85, 60, 40, 30, 20],
            is_public=True,
            is_featured=True,
            play_count=1820,
            like_count=94,
            isrc="US-FMB-26-10492",
            commercial_rights_status="commercial_granted",
        )
        track2 = Track(
            user_id=pro_user.id,
            title="Midnight Rain Lo-Fi",
            description="Warm vinyl crackle, nostalgic Rhodes piano chords, and chilled boom-bap percussion.",
            genre="Lo-Fi",
            style_tags=["lo-fi", "chill", "piano", "rhodes", "rain"],
            mood="Relaxing",
            bpm=82,
            musical_key="Eb Major",
            duration_seconds=160.0,
            audio_url="/api/v1/storage/file/tracks/demo_track_2.wav",
            waveform_data=[10, 20, 35, 50, 60, 55, 45, 50, 65, 70, 60, 45, 30, 20, 15],
            is_public=True,
            is_featured=True,
            play_count=2980,
            like_count=145,
            isrc="US-FMB-26-89421",
            commercial_rights_status="commercial_granted",
        )
        db.add_all([track1, track2])
        await db.flush()

        # 6. Stems
        stem_drums = Stem(
            track_id=track1.id,
            user_id=creator.id,
            stem_type="drums",
            audio_url="/api/v1/storage/file/stems/demo_drums.wav",
            duration_seconds=145.0,
            model_used="htdemucs_v4",
        )
        stem_bass = Stem(
            track_id=track1.id,
            user_id=creator.id,
            stem_type="bass",
            audio_url="/api/v1/storage/file/stems/demo_bass.wav",
            duration_seconds=145.0,
            model_used="htdemucs_v4",
        )
        db.add_all([stem_drums, stem_bass])

        # 7. Provenance Record
        provenance = Provenance(
            track_id=track1.id,
            creator_id=creator.id,
            model_provider="fombo_procedural",
            model_checkpoint_hash="sha256:dsp_procedural_fm_v1",
            generation_seed=428901,
            input_prompt_hash="sha256:7f89ab92cd0182",
            output_audio_sha256="sha256:9b3c41ef8821ad5e88bb00392ad17f309d9426f048d0d1e1f78a05c317540263",
            c2pa_manifest={
                "assertion_title": "C2PA Synthetic Audio Disclosure",
                "generator": "Fombo Music AI Audio Engine v1.0",
                "digital_source_type": "http://cv.iptc.org/newscodes/digitalsourcetype/syntheticMedia",
                "rights_holder": "Alex River",
            },
            license_type="commercial_sync",
            commercial_eligibility=True,
            disclaimer="Synthetic audio generated under Fombo Music AI Pro commercial license terms.",
        )
        db.add(provenance)

        # 8. Playlists
        playlist = Playlist(
            user_id=creator.id,
            title="Neon Cyberpunk Essentials",
            description="Top synthwave and cyberpunk tracks synthesized on Fombo.",
            is_public=True,
            track_count=2,
        )
        db.add(playlist)
        await db.flush()

        pt1 = PlaylistTrack(playlist_id=playlist.id, track_id=track1.id, position=0)
        pt2 = PlaylistTrack(playlist_id=playlist.id, track_id=track2.id, position=1)
        db.add_all([pt1, pt2])

        # 9. Likes & Comments
        like = Like(user_id=creator.id, track_id=track2.id)
        comment = Comment(
            user_id=creator.id,
            track_id=track1.id,
            timestamp_seconds=45.2,
            content="That transition at 0:45 is incredible! Love the analog warmth.",
        )
        db.add_all([like, comment])

        # 10. Commercial License
        license_rec = License(
            track_id=track1.id,
            user_id=pro_user.id,
            license_type="commercial",
            price_cents=1999,
            terms="Worldwide, non-exclusive synchronization and streaming monetization license.",
            isrc=track1.isrc,
            is_active=True,
        )
        db.add(license_rec)

        await db.commit()
        print("✅ Database successfully seeded with Phase 2 fixtures!")

if __name__ == "__main__":
    asyncio.run(seed())
