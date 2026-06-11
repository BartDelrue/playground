const res = await fetch('/api/hello')
const { message } = await res.json()
document.getElementById('app').textContent = message
