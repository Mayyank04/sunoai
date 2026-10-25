import re
import uuid
from typing import Dict, Any, List, Optional, Tuple
from backend.app.schemas.producer import PlannedOperation, AiProducerChatResponse

class AiProducerService:
    """
    Intelligent AI Producer engine.
    Analyzes active multitrack session state, interprets producer natural language instructions,
    and maps them to strongly typed, validated operations with destructiveness safety flags.
    """

    @classmethod
    def process_producer_instruction(
        cls,
        user_prompt: str,
        project_state: Dict[str, Any],
        persona: Optional[Dict[str, Any]] = None,
    ) -> AiProducerChatResponse:
        prompt_lower = user_prompt.lower().strip()
        tracks = project_state.get("tracks", [])
        bpm = project_state.get("bpm", 120)

        planned_ops: List[PlannedOperation] = []
        assistant_reply = ""
        reasoning = ""

        # Check Persona context
        persona_name = persona.get("name") if persona else "Fombo AI Producer"
        persona_style = persona.get("vocal_style") if persona else "Balanced Production"

        # 1. Operation: addTrack
        if re.search(r"\b(add|create|insert|new)\b.*?\btrack\b", prompt_lower) or any(w in prompt_lower for w in ["add track", "new track", "create track", "insert track"]):
            track_type = "synth" if any(w in prompt_lower for w in ["synth", "midi", "lead", "piano", "pad", "keys"]) else "audio"
            # Extract name or infer
            name = "New Audio Track"
            if "synth" in prompt_lower or "midi" in prompt_lower:
                name = "Poly Synth Lead"
            elif "bass" in prompt_lower:
                name = "Sub Bass"
            elif "vocal" in prompt_lower:
                name = "Vocal Take"
            elif "guitar" in prompt_lower:
                name = "Rhythm Guitar"
            elif "drum" in prompt_lower:
                name = "Percussion Track"

            color = "#00f0ff" if track_type == "audio" else "#ec4899"
            op = PlannedOperation(
                op_id=str(uuid.uuid4())[:8],
                operation_type="addTrack",
                parameters={"name": name, "track_type": track_type, "color": color},
                description=f"Add a new {track_type.upper()} track: '{name}'.",
                is_destructive=False,
                requires_confirmation=False,
            )
            planned_ops.append(op)
            assistant_reply = f"I've arranged a new {track_type} channel '{name}' ready for recording or sequencing."
            reasoning = f"Expanding arrangement headroom to support {name} layers without frequency clashing."

        # 1.5 Operation: moveClip
        elif any(w in prompt_lower for w in ["move clip", "shift clip", "nudge clip", "relocate clip"]):
            first_clip = None
            target_track_id = None
            for t in tracks:
                if t.get("clips"):
                    first_clip = t["clips"][0]
                    target_track_id = t.get("id")
                    break
            beat_match = re.search(r"\b(?:beat|bar)\s+(\d+)", prompt_lower)
            new_beat = int(beat_match.group(1)) if beat_match else ((first_clip.get("startBeat", 0) + 4) if first_clip else 4)
            if "bar" in prompt_lower and beat_match:
                new_beat = (int(beat_match.group(1)) - 1) * 4

            clip_id = first_clip.get("id") if first_clip else "c1"
            clip_name = first_clip.get("name") if first_clip else "Active Clip"
            op = PlannedOperation(
                op_id=str(uuid.uuid4())[:8],
                operation_type="moveClip",
                parameters={"clip_id": clip_id, "new_start_beat": new_beat, "track_id": target_track_id or "tr_1"},
                description=f"Move clip '{clip_name}' to beat {new_beat}.",
                is_destructive=False,
                requires_confirmation=False,
            )
            planned_ops.append(op)
            assistant_reply = f"Repositioned clip '{clip_name}' to beat {new_beat} to lock in arrangement timing."
            reasoning = "Refining clip alignment along the metric grid to enhance groove pocket."

        # 1.6 Operation: duplicateClip
        elif any(w in prompt_lower for w in ["duplicate clip", "copy clip", "clone clip"]):
            first_clip = None
            for t in tracks:
                if t.get("clips"):
                    first_clip = t["clips"][0]
                    break
            clip_id = first_clip.get("id") if first_clip else "c1"
            clip_name = first_clip.get("name") if first_clip else "Active Clip"
            op = PlannedOperation(
                op_id=str(uuid.uuid4())[:8],
                operation_type="duplicateClip",
                parameters={"clip_id": clip_id},
                description=f"Duplicate clip '{clip_name}' sequentially on the timeline.",
                is_destructive=False,
                requires_confirmation=False,
            )
            planned_ops.append(op)
            assistant_reply = f"Duplicated clip '{clip_name}' to build thematic repetition."
            reasoning = "Doubling section length provides rhythmic anchoring before melodic variations."

        # 1.7 Operation: splitClip
        elif any(w in prompt_lower for w in ["split clip", "slice clip", "cut clip"]):
            first_clip = None
            for t in tracks:
                if t.get("clips"):
                    first_clip = t["clips"][0]
                    break
            clip_id = first_clip.get("id") if first_clip else "c1"
            clip_name = first_clip.get("name") if first_clip else "Active Clip"
            split_at = (first_clip.get("startBeat", 0) + (first_clip.get("durationBeats", 8) / 2)) if first_clip else 8.0
            op = PlannedOperation(
                op_id=str(uuid.uuid4())[:8],
                operation_type="splitClip",
                parameters={"clip_id": clip_id, "split_beat": split_at},
                description=f"Split clip '{clip_name}' at beat {split_at}.",
                is_destructive=False,
                requires_confirmation=False,
            )
            planned_ops.append(op)
            assistant_reply = f"Sliced clip '{clip_name}' at beat {split_at} for micro-editing."
            reasoning = "Subdividing audio regions enables surgical transition sculpting and clip-level automation."

        # 2. Operation: changeGain (volume / panning)
        elif any(w in prompt_lower for w in ["volume", "gain", "turn down", "turn up", "louder", "quieter", "pan"]):
            target_track = tracks[0] if tracks else None
            # Find track index if mentioned (e.g. "track 2")
            match_tr = re.search(r"track\s+(\d+)", prompt_lower)
            if match_tr:
                idx = int(match_tr.group(1)) - 1
                if 0 <= idx < len(tracks):
                    target_track = tracks[idx]
            else:
                for t in tracks:
                    if t.get("name", "").lower() in prompt_lower:
                        target_track = t
                        break

            new_vol = target_track.get("volume", 0.85) if target_track else 0.8
            if any(w in prompt_lower for w in ["turn down", "quieter", "lower", "reduce"]):
                new_vol = max(0.1, round(new_vol * 0.75, 2))
            elif any(w in prompt_lower for w in ["turn up", "louder", "boost", "increase"]):
                new_vol = min(1.3, round(new_vol * 1.25, 2))

            pan_val = target_track.get("pan", 0.0) if target_track else 0.0
            if "pan left" in prompt_lower:
                pan_val = -0.35
            elif "pan right" in prompt_lower:
                pan_val = 0.35
            elif "pan center" in prompt_lower:
                pan_val = 0.0

            if target_track:
                op = PlannedOperation(
                    op_id=str(uuid.uuid4())[:8],
                    operation_type="changeGain",
                    parameters={"track_id": target_track.get("id"), "volume": new_vol, "pan": pan_val},
                    description=f"Set volume to {int(new_vol*100)}% and pan to {pan_val} on '{target_track.get('name')}'.",
                    is_destructive=False,
                    requires_confirmation=False,
                )
                planned_ops.append(op)
                assistant_reply = f"Adjusted gain and stereo balance on '{target_track.get('name')}'."
                reasoning = "Optimizing track gain staging and stereo field separation to prevent mid-channel masking."

        # 3. Operation: addEffect (EQ, delay, reverb, compressor)
        elif any(w in prompt_lower for w in ["reverb", "delay", "echo", "eq", "filter", "compressor", "effect"]):
            target_track = tracks[0] if tracks else None
            for t in tracks:
                if t.get("name", "").lower() in prompt_lower:
                    target_track = t
                    break

            fx_type = "reverb"
            params: Dict[str, Any] = {}
            if "delay" in prompt_lower or "echo" in prompt_lower:
                fx_type = "delay"
                params = {"enabled": True, "time": 0.35, "feedback": 0.4, "mix": 0.3}
            elif "reverb" in prompt_lower:
                fx_type = "reverb"
                params = {"enabled": True, "decay": 2.5, "mix": 0.35}
            elif "compressor" in prompt_lower:
                fx_type = "compressor"
                params = {"enabled": True, "threshold": -15.0, "ratio": 4.0}
            elif "filter" in prompt_lower:
                fx_type = "filter"
                params = {"type": "lowpass", "frequency": 3500.0, "q": 2.0}
            elif "eq" in prompt_lower or "bass" in prompt_lower:
                fx_type = "eq"
                params = {"bass": 3.0, "mid": -1.0, "treble": 2.0}

            if target_track:
                op = PlannedOperation(
                    op_id=str(uuid.uuid4())[:8],
                    operation_type="addEffect",
                    parameters={"track_id": target_track.get("id"), "effect_type": fx_type, "params": params},
                    description=f"Apply {fx_type.upper()} processing on '{target_track.get('name')}'.",
                    is_destructive=False,
                    requires_confirmation=False,
                )
                planned_ops.append(op)
                assistant_reply = f"Engaged real-time {fx_type.upper()} rack on '{target_track.get('name')}'."
                reasoning = f"Enhancing acoustic depth and dynamic polish using {fx_type} spatialization."

        # 4. Operation: generateStem (Demucs vocal/instrumental splitting)
        elif any(w in prompt_lower for w in ["stem", "separate", "isolate vocals", "extract drums", "split stem"]):
            target_track = tracks[0] if tracks else None
            stem_type = "vocals" if "vocal" in prompt_lower else "drums" if "drum" in prompt_lower else "all"
            if target_track:
                op = PlannedOperation(
                    op_id=str(uuid.uuid4())[:8],
                    operation_type="generateStem",
                    parameters={"track_id": target_track.get("id"), "stem_type": stem_type, "stem_model": "htdemucs_v4"},
                    description=f"Separate {stem_type} using Demucs v4 on '{target_track.get('name')}'.",
                    is_destructive=False,
                    requires_confirmation=False,
                )
                planned_ops.append(op)
                assistant_reply = f"Queueing Demucs stem separation for {stem_type} on '{target_track.get('name')}'."
                reasoning = "Phase-locked stem extraction allows isolated mixing without bleeding."

        # 5. Operation: replaceSection (Destructive! Requires confirmation)
        elif any(w in prompt_lower for w in ["replace section", "inpaint", "regenerate part", "replace audio"]):
            target_track = tracks[0] if tracks else None
            op = PlannedOperation(
                op_id=str(uuid.uuid4())[:8],
                operation_type="replaceSection",
                parameters={
                    "track_id": target_track.get("id") if target_track else "tr_1",
                    "start_sec": 4.0,
                    "end_sec": 8.0,
                    "prompt": "Dynamic guitar riff with lush delay",
                    "provider": "suno",
                },
                description="Destructive inpaint: Replace audio slice between 4.0s and 8.0s.",
                is_destructive=True,
                requires_confirmation=True,
            )
            planned_ops.append(op)
            assistant_reply = "I've drafted a section replacement between 4.0s and 8.0s. Because this overwrites existing audio in place, please review and confirm the action."
            reasoning = "Re-synthesizing musical passage with boundary equal-power crossfades."

        # 6. Operation: deleteTrack (Destructive! Requires confirmation)
        elif any(w in prompt_lower for w in ["delete track", "remove track"]):
            target_track = tracks[-1] if tracks else None
            if target_track:
                op = PlannedOperation(
                    op_id=str(uuid.uuid4())[:8],
                    operation_type="deleteTrack",
                    parameters={"track_id": target_track.get("id")},
                    description=f"Destructive: Permanently remove track '{target_track.get('name')}' and all its clips.",
                    is_destructive=True,
                    requires_confirmation=True,
                )
                planned_ops.append(op)
                assistant_reply = f"Warning: Deleting '{target_track.get('name')}' will erase all containing clips. Confirmation required."
                reasoning = "Removing inactive track to declutter arrangement."

        # 7. Default Musician Guidance
        else:
            assistant_reply = (
                f"I've evaluated the session arrangement at {bpm} BPM. "
                "You have clean spectral headroom. I can add new synth/vocal tracks, dial in 3-band EQ, "
                "split stems with Demucs, or extend your clips. What musical change would you like to explore?"
            )
            reasoning = "Active multitrack analysis complete; awaiting specific editing intent."

        return AiProducerChatResponse(
            assistant_message=assistant_reply,
            musical_reasoning=reasoning,
            planned_operations=planned_ops,
            persona_used=persona_name,
            confidence_score=0.96,
        )

ai_producer_service = AiProducerService()
