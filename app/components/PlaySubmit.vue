<script setup lang="ts">

const {examKey: key = ''} = defineProps<{examKey?: string}>()

const revealed = ref(false)
const localKey = ref(key)
const message = ref('')
const id = useId()
const isSuccess = ref<Boolean | undefined>()

watch(isSuccess, (newValue) => {
  if (newValue) setTimeout(() => isSuccess.value = undefined, 5*1000)
})

const handleSubmit = () => {

  const stamp = `[${new Date().toLocaleTimeString()}] `

  if (!localKey.value) {
    message.value = stamp + 'key is required!\n\n' + message.value
    isSuccess.value = false
    return
  }

  const location = window.parent ? window.parent.location : window.location

  if (!location) {
    message.value = stamp + 'Error getting URL\n\n' + message.value
    isSuccess.value = false
    return
  }

  message.value = stamp + 'sending \n' + location + '\n\n' + message.value

  fetch(`/api/submit`, {
    method: 'POST',
    headers: {
      "Content-Type": "Application/JSON"
    },
    body: JSON.stringify({
      key: localKey.value,
      url: location.href
    })
  }).then(r => {
    if (!r.ok) throw new Error(r.statusText)
    return r.json()
  }).then(json => {
    message.value = stamp +  `${json.message}\n\n` + message.value
    isSuccess.value = true
  }).catch(_ => {
    isSuccess.value = false
    message.value = stamp + '\n----------\n\nFAILED TO SUBMIT\nCONTACT SUPERVISOR!\n\n----------\n\n' + message.value
  })
}

</script>

<template>
  <form @submit.prevent="handleSubmit" class="playSubmit" :class="{fail: isSuccess === false, success: isSuccess === true}">
    <label class="label" :for="id">
      Exam key
    </label>
    <div class="flex g-1">
      <input :id="id" v-model="localKey" class="input" :class="{ masked: !revealed}" autocomplete="new-password">
      <button
          type="button" class="add-file-btn" title="toggle reveal" @mousedown="revealed = true"
          @mouseup="revealed = false">
        <Icon style="font-size: 1rem" :name="revealed ? 'lucide:eye-off' : 'lucide:eye'"/>
      </button>
    </div>
    <button class="btn" type="submit">Send
      <Icon name="lucide:send-horizontal"/>
    </button>

    <pre class="message">{{ message }}</pre>
  </form>

</template>

<style scoped>
.message {
  //font-size: .8em;
  font-family: monospace;
  text-wrap: auto;
  word-break: break-all;
  margin-block: var(--space-3)
}

.masked {
  -webkit-text-security: disc; /* supported in all major browsers now */
}

.playSubmit {
  transition: background-color .2s ease-in-out;
}

.fail {
  background-color: oklch(from var(--red) l c h / .2);
}
.success {
  background-color: oklch(from var(--green) l c h / .2);
}


</style>
