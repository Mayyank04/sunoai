import { test, expect, Page } from "@playwright/test";

// Contract tests for the web app. These do not claim model inference or audible singing.
const lyrics = "[Verse]\nUnder the amber sky I sing\nHear every hope the morning brings\n[Chorus]\nCarry my song across the sea\nBring all the light back home to me";
const ace = {
  provider_id: "ace_step_1_5", display_name: "ACE-Step 1.5", description: "Lyrics-conditioned music",
  supports_vocals: true, supports_lyrics: true, supports_dual_variants: false,
  models_available: ["acestep-v15-turbo"], min_duration_seconds: 10, max_duration_seconds: 180,
  provider_type: "self_hosted", is_configured: true,
};
const procedural = {
  ...ace, provider_id: "fombo_procedural", display_name: "Procedural DSP", provider_type: "built_in",
  supports_vocals: false, supports_lyrics: false, models_available: ["procedural-dsp-v1"],
};

async function session(page: Page, ready: boolean, getBalance = () => 50) {
  await page.addInitScript(() => localStorage.setItem("fombo_token", "web-contract-test-token"));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: { id: "contract-user", email: "test@example.test", username: "singer", role: "creator", credits_balance: getBalance(), is_verified: true } }));
  await page.route("**/api/v1/generation/providers", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ json: [procedural, ace] });
  });
  await page.route("**/api/v1/generation/providers/*/ready", (route) => route.fulfill({ json: { ready, message: ready ? "Checkpoint loaded on GPU" : "CUDA GPU unavailable. No credits reserved." } }));
  await page.route("**/api/v1/generation/estimate", (route) => route.fulfill({ json: { credits_required: 9, estimated_duration_seconds: 30 } }));
}

test("retains lyrics and vocal checkpoint after delayed capabilities and blocks an unavailable GPU", async ({ page }) => {
  const chunkErrors: string[] = [];
  page.on("pageerror", (error) => { if (/chunk/i.test(error.message)) chunkErrors.push(error.message); });
  await session(page, false);
  let submitted = false;
  await page.route("**/api/v1/generation/create", (route) => { submitted = true; return route.fulfill({ status: 500 }); });
  await page.goto(`/create?provider=ace_step_1_5&lyrics=${encodeURIComponent(lyrics)}`);
  await expect(page.locator("textarea").first()).toHaveValue(lyrics);
  await expect(page.getByRole("button", { name: "Vocals Enabled" })).toBeVisible();
  await expect(page.locator("select").filter({ has: page.locator('option[value="acestep-v15-turbo"]') })).toHaveValue("acestep-v15-turbo");
  await expect(page.getByRole("button", { name: "Generation Engine Unavailable" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("CUDA GPU unavailable");
  expect(submitted).toBe(false);
  expect(chunkErrors).toEqual([]);
});

test("sends real lyrics and selected checkpoint, shows worker failures and refreshed credits", async ({ page }) => {
  let balance = 50;
  await session(page, true, () => balance);
  await page.route("**/api/v1/generation/create", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.provider).toBe("ace_step_1_5");
    expect(body.model_name).toBe("acestep-v15-turbo");
    expect(body.lyrics).toBe(lyrics);
    expect(body.make_instrumental).toBe(false);
    expect(body.generate_two_variants).toBe(false);
    expect(route.request().headers().authorization).toBe("Bearer web-contract-test-token");
    balance = 41;
    await route.fulfill({ status: 202, json: { job_id: "job_contract", status: "queued", remaining_balance: balance, variants_supported: false } });
  });
  let polls = 0;
  await page.route("**/api/v1/generation/job_contract/status", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer web-contract-test-token");
    polls += 1;
    if (polls === 1) await route.fulfill({ json: { status: "queued", progress_percentage: 0, current_stage: "GPU queue" } });
    else { balance = 50; await route.fulfill({ json: { status: "failed", progress_percentage: 0, error_message: "CHECKPOINT_MISSING: install the checkpoint on the GPU worker." } }); }
  });
  await page.goto(`/create?provider=ace_step_1_5&lyrics=${encodeURIComponent(lyrics)}`);
  await page.getByRole("button", { name: "Generate Master Audio (9 Credits)" }).click();
  await expect(page.getByText("GPU queue", { exact: true })).toBeVisible();
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  await expect(page.getByText("CHECKPOINT_MISSING: install the checkpoint on the GPU worker.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fombo_active_generation_contract-user"))).toBeNull();
});

test("surfaces structured API errors instead of object text", async ({ page }) => {
  await session(page, true);
  await page.route("**/api/v1/generation/create", (route) => route.fulfill({ status: 503, json: { detail: { error_code: "WORKER_OFFLINE", message: "GPU inference worker is offline; no credits reserved." } } }));
  await page.goto(`/create?provider=ace_step_1_5&lyrics=${encodeURIComponent(lyrics)}`);
  await page.getByRole("button", { name: "Generate Master Audio (9 Credits)" }).click();
  await expect(page.getByText("GPU inference worker is offline; no credits reserved.", { exact: true })).toBeVisible();
  await expect(page.getByText("[object Object]", { exact: true })).toHaveCount(0);
});

test("resumes saved jobs and plays the persisted library track with honest media errors", async ({ page }) => {
  await session(page, false);
  await page.addInitScript(() => localStorage.setItem("fombo_active_generation_contract-user", "job_saved"));
  await page.route("**/api/v1/generation/job_saved/status", (route) => route.fulfill({ json: {
    status: "completed", progress_percentage: 100, track_id: "saved-song", audio_url: "/api/v1/storage/file/tracks/saved.wav",
  } }));
  await page.route("**/api/v1/tracks/saved-song", (route) => route.fulfill({ json: {
    id: "saved-song", title: "Original saved song", genre: "Pop", musical_key: "C Major", bpm: 100,
    duration_seconds: 30, audio_url: "/api/v1/storage/file/tracks/saved.wav", lyrics,
    commercial_rights_status: "pending_review",
  } }));
  await page.route("**/api/v1/storage/file/tracks/saved.wav", (route) => route.fulfill({ status: 404, body: "missing audio fixture" }));
  await page.goto("/create");
  await expect(page.getByRole("heading", { name: "Original saved song", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open saved songs in your library/ })).toHaveAttribute("href", "/library");
  await expect(page.getByRole("button", { name: "Play Master", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fombo_active_generation_contract-user"))).toBeNull();
  await expect(page.getByRole("alert")).toContainText(/audio could not be loaded|Playback failed|Press Play/);
});
