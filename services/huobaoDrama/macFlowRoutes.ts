import { createHmac } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

function readOrigin(value: string | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash) return url.origin
  } catch { /* Ignore invalid service configuration. */ }
}

const macFlow = new Hono()
const origin = readOrigin(process.env.TOONFLOW_HUOBAO_MACFLOW_ORIGIN)
const publicMacFlow = readOrigin(process.env.TOONFLOW_PUBLIC_URL) ?? 'http://127.0.0.1:3000'
const publicHuobao = new URL(readOrigin(process.env.HUOBAO_PUBLIC_ORIGIN) ?? `http://127.0.0.1:${process.env.PORT || '5679'}`)
const sharedToken = process.env.TOONFLOW_HUOBAO_TOKEN ?? ''
const authorization = /^[a-zA-Z0-9_-]{32,256}$/.test(sharedToken)
  ? 'Bearer ' + createHmac('sha256', sharedToken).update('macflow-huobao-control-v1').digest('hex') : ''
const hosts = new Set([publicHuobao.host])
if (['127.0.0.1', 'localhost'].includes(publicHuobao.hostname)) {
  hosts.add(publicHuobao.host.replace(publicHuobao.hostname, publicHuobao.hostname === 'localhost' ? '127.0.0.1' : 'localhost'))
}

macFlow.use('*', async (c, next) => {
  const host = c.req.header('host') ?? ''
  const browserOrigin = c.req.header('origin')
  c.header('Cache-Control', 'no-store')
  if (!hosts.has(host) || c.req.header('sec-fetch-site') !== 'same-origin' ||
    (browserOrigin !== undefined && browserOrigin !== `${publicHuobao.protocol}//${host}`) ||
    (c.req.method === 'POST' && (browserOrigin !== `${publicHuobao.protocol}//${host}` ||
      !/^application\/json(?:\s*;|$)/i.test(c.req.header('content-type') ?? '')))) {
    return c.json({ message: 'Mở Huobao từ mục Phim ngắn của MacFlow rồi thử lại.' }, 403)
  }
  await next()
})
macFlow.get('/info', c => c.json({ data: { macFlowUrl: publicMacFlow } }))

async function forward(path: string, method: 'GET' | 'POST', signal: AbortSignal, body?: string) {
  if (!origin || !authorization) return Response.json({ message: 'Chưa thiết lập kết nối MacFlow cho Huobao.' }, { status: 503 })
  try {
    const response = await fetch(new URL(`/api/huobao/partner${path}`, origin), {
      method, body, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(40_000)]),
      headers: { authorization, ...(body ? { 'content-type': 'application/json' } : {}) },
    })
    const type = response.headers.get('content-type') ?? ''
    if (!/^(application\/json|image\/(png|jpeg|webp))(?:;|$)/i.test(type)) {
      await response.body?.cancel()
      return Response.json({ message: 'MacFlow chưa hỗ trợ kết nối này. Hãy cập nhật MacFlow.' }, { status: 502 })
    }
    return new Response(response.body, { status: response.status, headers: {
      'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    } })
  } catch {
    return Response.json({ message: 'Chưa kết nối được MacFlow. Hãy mở MacFlow rồi thử lại.' }, { status: 502 })
  }
}

for (const path of ['/models', '/images', '/image']) {
  macFlow.get(path, c => forward(path + new URL(c.req.url).search, 'GET', c.req.raw.signal))
}
for (const path of ['/configure', '/useImage']) {
  macFlow.post(path, bodyLimit({ maxSize: 16_384 }), async c => forward(path, 'POST', c.req.raw.signal, await c.req.text()))
}

export default macFlow
