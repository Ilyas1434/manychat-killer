import Zernio from '@zernio/node'

declare global {
  // eslint-disable-next-line no-var
  var _zernioClient: Zernio | undefined
}

export function getZernio(): Zernio {
  if (!global._zernioClient) {
    global._zernioClient = new Zernio({ apiKey: process.env.ZERNIO_API_KEY })
  }
  return global._zernioClient
}

export const PROFILE_ID = process.env.ZERNIO_PROFILE_ID!
export const ACCOUNT_ID = process.env.ZERNIO_ACCOUNT_ID!
