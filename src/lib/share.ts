import { normalizeDiagram, type Diagram } from './uml'

// Share links carry the whole diagram, deflated and base64url-encoded, in the URL hash —
// nothing ever leaves the browser except through the link itself.
const HASH_KEY = 'share='

function toBase64Url(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function makeShareUrl(d: Diagram) {
  const { name, nodes, edges } = d
  const json = new TextEncoder().encode(JSON.stringify({ name, nodes, edges }))
  const packed = await pipe(json, new CompressionStream('deflate-raw'))
  const url = new URL(window.location.href)
  url.hash = HASH_KEY + toBase64Url(packed)
  return url.toString()
}

/** Reads (and then strips) a shared diagram from the URL hash, if there is one. */
export async function readShareHash(): Promise<Diagram | null> {
  const hash = window.location.hash.slice(1)
  if (!hash.startsWith(HASH_KEY)) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  const bytes = await pipe(fromBase64Url(hash.slice(HASH_KEY.length)), new DecompressionStream('deflate-raw'))
  return normalizeDiagram(JSON.parse(new TextDecoder().decode(bytes)))
}
