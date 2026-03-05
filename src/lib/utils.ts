export const formatShortTime = (timestamp?: number | null) => {
  if (!timestamp) return ""
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export const formatShortDate = (timestamp?: number | null) => {
  if (!timestamp) return ""
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export const formatRelative = (timestamp?: number | null) => {
  if (!timestamp) return ""
  const delta = Date.now() - timestamp * 1000
  const seconds = Math.floor(delta / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(timestamp)
}

export const initials = (name?: string) => {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const letters = parts.slice(0, 2).map((p) => p[0].toUpperCase())
  return letters.join("")
}

export const copyToClipboard = async (text: string) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    document.execCommand("copy")
    return true
  } finally {
    document.body.removeChild(textarea)
  }
}
