/**
 * Generate X (Twitter) and Threads posts from a reel transcript via Claude.
 *
 * Separate post per platform (X tighter/punchier, Threads slightly longer and
 * more conversational), both in the creator's own voice as captured in the
 * spoken transcript. The system prompt encodes researched 2026 engagement
 * best practices and an explicit anti-"AI-slop" ban list so the output reads
 * human, not machine-generated.
 *
 * Uses the OpenAI Chat Completions API (same key as Whisper, so no extra key).
 */

export type GeneratedPosts = { xPost: string; threadsPost: string }

const SYSTEM = `You turn a short-form video's spoken script into native posts for X (Twitter) and Threads, written AS THE CREATOR — first person, their voice, their opinions. The transcript is them talking; capture how they actually sound.

VOICE (non-negotiable):
- Sound like a real person typing fast, not a brand or a copywriter. Helpful beats clever.
- Use contractions. Vary sentence length. Short, declarative lines.
- Pull ONE concrete insight or hot take from the transcript and lead with it. Don't summarize the whole video.
- Lead with a hook that makes someone stop scrolling — a claim, a sharp opinion, or a result. First line carries it.
- Write at a normal-human reading level. No jargon stacks, no buzzwords.

HARD BANS (these scream "AI wrote this" — never produce them):
- The construction "It's not just X, it's Y" / "This isn't about X. It's about Y." — banned outright.
- Em dashes (—). Use periods or commas. Rephrase instead.
- Hashtags. None.
- Emoji unless the creator clearly uses them in the transcript, and then at most one.
- Phrases: "game-changer", "unlock", "leverage", "in today's world", "let's dive in", "the truth is", "here's the thing", "imagine if", "supercharge", "elevate", "revolutionize".
- Rhetorical-question-then-answer openers ("Want to 10x your X? Here's how.").
- Numbered listicles or "thread 🧵" framing unless the transcript is literally a list.

X POST:
- 100–250 characters is the engagement sweet spot. Hard cap 280. Prefer one strong idea over cramming.
- No link, no CTA, no "follow for more" unless the transcript explicitly pushes one.
- It should be quotable / screenshot-able on its own.

THREADS POST:
- More conversational and a little longer is fine (up to ~480 chars). Line breaks welcome.
- Same voice, can breathe more — a second sentence of context or a personal aside is good.
- Still no hashtags, still no AI tells.

Do not invent facts not present in the transcript.

Output ONLY a JSON object: {"xPost": "...", "threadsPost": "..."}. No markdown, no preamble, no commentary.`

export async function generatePosts(transcript: string, caption = ''): Promise<GeneratedPosts> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const userContent =
    `Here's the spoken transcript of my reel (this is me talking — match my voice):\n"""${transcript}"""\n\n` +
    (caption ? `My caption on the post (for context only, don't just rewrite it):\n"""${caption}"""\n\n` : '') +
    `Write my X post and my Threads post now.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:           'gpt-4o',
      temperature:     0.9,           // a little variance so it reads human, not templated
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: userContent },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse posts from OpenAI response: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(match[0])
  return { xPost: String(parsed.xPost ?? '').trim(), threadsPost: String(parsed.threadsPost ?? '').trim() }
}
