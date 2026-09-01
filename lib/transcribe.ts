/**
 * Transcribe a reel's audio → text "script" via OpenAI Whisper (whisper-1).
 *
 * The IG caption is NOT the spoken script, so we send the actual video bytes
 * to Whisper. whisper-1 accepts video containers (mp4/mov) and pulls the audio
 * track itself, so no ffmpeg step is needed. ~$0.006/min.
 */

export async function transcribe(video: Buffer, filename = 'reel.mp4'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const form = new FormData()
  // Buffer → Blob for multipart upload (Node 18+ / Vercel runtime have Blob).
  form.append('file', new Blob([new Uint8Array(video)], { type: 'video/mp4' }), filename)
  form.append('model', 'whisper-1')
  form.append('response_format', 'text')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    form,
  })

  if (!res.ok) throw new Error(`Whisper failed ${res.status}: ${await res.text()}`)
  // response_format=text returns the transcript as a plain string body.
  return (await res.text()).trim()
}
