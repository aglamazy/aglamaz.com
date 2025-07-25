type DecodedToken = {
    exp?: number
    [key: string]: any
  }
  
  /**
   * Decodes a JWT token and checks if it's still valid by expiration date.
   * @param token JWT string
   * @returns Decoded payload if valid, or null if invalid/expired
   */
  export function decodeAndValidateToken(token: string): DecodedToken | null {
    try {
      const [, payloadBase64] = token.split('.')
      if (!payloadBase64) return null
  
      const json = Buffer.from(payloadBase64, 'base64').toString('utf8')
      const payload: DecodedToken = JSON.parse(json)
  
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) return null
  
      return payload
    } catch (err) {
      console.error('Token decode failed:', err)
      return null
    }
  }
  