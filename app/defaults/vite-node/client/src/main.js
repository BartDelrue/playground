const res = await fetch('/api/hello');
const { message } = await res.json();
document.body.innerHTML = `<h1>${message}</h1>`;
