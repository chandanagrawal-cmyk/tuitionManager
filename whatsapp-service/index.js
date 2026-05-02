const express = require('express')
const { Client, RemoteAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const axios = require('axios')

const app = express()
app.use(express.json())

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000'
const PORT = 3001

let qrData = null
let status = 'disconnected'

function normaliseNumber(raw) {
  let n = raw.toString().replace(/[^\d+]/g, '')
  if (n.startsWith('+')) return n.slice(1)
  if (n.startsWith('44')) return n
  if (n.startsWith('0')) return '44' + n.slice(1)
  return '44' + n
}

// Remote store that persists session to backend DB
const store = {
  async sessionExists({ session }) {
    try {
      const r = await axios.get(`${BACKEND_URL}/api/whatsapp/session/load`, { timeout: 5000 })
      return Object.keys(r.data).some(k => k === session)
    } catch { return false }
  },
  async save({ session, data }) {
    try {
      console.log(`Saving session: ${session}`)
      const payload = {}
      payload[session] = JSON.stringify(data)
      await axios.post(`${BACKEND_URL}/api/whatsapp/session/save`, payload, { timeout: 5000 })
      console.log(`Session ${session} saved successfully`)
    } catch (e) { console.error('Session save error:', e.message) }
  },
  async extract({ session }) {
    try {
      const r = await axios.get(`${BACKEND_URL}/api/whatsapp/session/load`, { timeout: 5000 })
      const val = r.data[session]
      return val ? JSON.parse(val) : null
    } catch { return null }
  },
  async delete({ session }) {
    try {
      await axios.post(`${BACKEND_URL}/api/whatsapp/session/save`, { [session]: '' }, { timeout: 5000 })
    } catch (e) { console.error('Session delete error:', e.message) }
  }
}

const client = new Client({
  authStrategy: new RemoteAuth({
    clientId: 'tuition-manager',
    store: store,
    backupSyncIntervalMs: 60000 // sync every minute
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
  },
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  },
})

client.on('qr', async qr => {
  status = 'qr_ready'
  qrData = await qrcode.toDataURL(qr)
  console.log('QR code ready')
})

client.on('ready', () => {
  status = 'connected'
  qrData = null
  console.log('WhatsApp connected!')
})

client.on('disconnected', () => {
  status = 'disconnected'
  qrData = null
  console.log('WhatsApp disconnected')
})

client.on('message', async msg => {
  if (msg.isStatus) return
  if (msg.from.endsWith('@g.us')) return  // skip group messages
  try {
    const from = msg.from.replace('@c.us', '').replace('@s.whatsapp.net', '')
    await axios.post(`${BACKEND_URL}/api/whatsapp/receive`, {
      from,
      body: msg.body,
      timestamp: msg.timestamp,
      message_id: msg.id.id,
    })
  } catch (e) {
    console.error('Failed to forward message to backend:', e.message)
  }
})

// Wait for backend to be ready before initialising
async function waitForBackend(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.get(`${BACKEND_URL}/api/whatsapp/session/load`, { timeout: 3000 })
      console.log('Backend ready, initialising WhatsApp client...')
      return true
    } catch {
      console.log(`Waiting for backend... (${i + 1}/${retries})`)
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  return false
}

waitForBackend().then(ready => {
  if (ready) client.initialize()
  else console.error('Backend not available, WhatsApp client not started')
})

app.get('/status', (req, res) => res.json({ status }))

app.get('/qr', (req, res) => {
  if (!qrData) return res.status(404).json({ error: 'No QR available', status })
  res.json({ qr: qrData, status })
})

app.get('/check/:number', async (req, res) => {
  if (status !== 'connected') return res.status(503).json({ error: 'Not connected' })
  try {
    const clean = normaliseNumber(req.params.number)
    const isRegistered = await client.isRegisteredUser(clean + '@c.us')
    res.json({ registered: isRegistered, number: clean })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Unknown error' })
  }
})

app.post('/send', async (req, res) => {
  const { number, message } = req.body
  if (!number || !message) return res.status(400).json({ error: 'number and message required' })
  if (status !== 'connected') return res.status(503).json({ error: `WhatsApp not connected — status: ${status}` })
  try {
    const clean = normaliseNumber(number)
    const chatId = clean + '@c.us'
    console.log(`Sending to ${chatId}`)
    await client.sendMessage(chatId, message)
    res.json({ ok: true })
  } catch (e) {
    console.error('Send error:', e?.message || e)
    res.status(500).json({ error: e?.message || e?.toString() || 'Unknown error' })
  }
})

app.listen(PORT, () => console.log(`WhatsApp service running on port ${PORT}`))
