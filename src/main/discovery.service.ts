import { networkInterfaces } from 'os'
import type { DiscoveredDevice } from '../shared/types'

const NANOLEAF_PORT = 16021
const SSDP_ADDR = '239.255.255.250'
const SSDP_PORT = 1900

function dedupByName(devices: DiscoveredDevice[]): DiscoveredDevice[] {
  const seen = new Set<string>()
  return devices.filter(d => {
    // Prefer device name, fallback to host:port
    const key = d.name && !d.name.startsWith('Nanoleaf-') ? d.name : `${d.host}:${d.port}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function ssdpDiscover(): Promise<DiscoveredDevice[]> {
  const dgram = await import('dgram')
  const results: DiscoveredDevice[] = []

  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const timer = setTimeout(() => {
      socket.close()
      resolve(results)
    }, 5000)

    socket.on('message', (msg: Buffer) => {
      const text = msg.toString()
      if (!text.includes('200 OK') && !text.includes('nanoleaf')) return

      const locMatch = text.match(/LOCATION:\s*http:\/\/([\d.]+):(\d+)/i)
        || text.match(/Location:\s*http:\/\/([\d.]+):(\d+)/i)
      if (locMatch) {
        const host = locMatch[1]
        const port = parseInt(locMatch[2]) || NANOLEAF_PORT

        const nameMatch = text.match(/nl-devicename:\s*(.+)/i)
          || text.match(/USN:\s*uuid:[^:]+::(.+)/i)
        const name = nameMatch ? nameMatch[1].trim() : undefined

        if (!results.find(r => r.host === host)) {
          results.push({ host, port, name: name || `Nanoleaf-${host}` })
        }
      }
    })

    socket.on('error', () => {
      clearTimeout(timer)
      socket.close()
      resolve(results)
    })

    socket.bind(() => {
      socket.addMembership(SSDP_ADDR)
      const msearch = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` +
        'MAN: "ssdp:discover"\r\n' +
        'ST: ssdp:all\r\n' +
        'MX: 2\r\n\r\n'
      )
      socket.send(msearch, 0, msearch.length, SSDP_PORT, SSDP_ADDR)
    })
  })
}

export async function scanNetwork(): Promise<DiscoveredDevice[]> {
  const results: DiscoveredDevice[] = []
  const baseIps = getLocalBaseIPs()
  if (baseIps.length === 0) return results

  const scanSubnet = async (baseIp: string) => {
    const promises: Promise<void>[] = []
    for (let i = 1; i <= 254; i++) {
      const host = `${baseIp}.${i}`
      promises.push(
        (async () => {
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 1500)
            const res = await fetch(`http://${host}:${NANOLEAF_PORT}/api/v1/new`, {
              method: 'POST',
              signal: controller.signal
            })
            clearTimeout(timeout)
            if (res.status === 403 || res.status === 200) {
              results.push({ host, port: NANOLEAF_PORT, name: `Nanoleaf-${host}` })
            }
          } catch { /* unreachable */ }
        })()
      )
    }
    await Promise.allSettled(promises)
  }

  await Promise.all(baseIps.map(scanSubnet))
  return results
}

export async function discoverDevices(): Promise<DiscoveredDevice[]> {
  // Try SSDP first, fall back to subnet scan
  const ssdpResults = await ssdpDiscover()
  if (ssdpResults.length > 0) return dedupByName(ssdpResults)
  return dedupByName(await scanNetwork())
}

function getLocalBaseIPs(): string[] {
  const bases = new Set<string>()
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.')
        bases.add(`${parts[0]}.${parts[1]}.${parts[2]}`)
      }
    }
  }
  return [...bases]
}
