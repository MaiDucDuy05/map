export async function retryWithBackoff<T>(
  fn: () => Promise<T>,  
  maxRetries = 3         
): Promise<T> {

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()   
    } catch (error: any) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        console.log(`Rate limit hit. Retrying in ${delay/1000} seconds...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue 
      }
      throw error 
    }
  }
  throw new Error("Max retries exceeded") 
}