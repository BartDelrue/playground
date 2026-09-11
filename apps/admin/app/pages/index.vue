<script setup lang="ts">
import { reviewUrl, type Submission } from '@playground/shared'

const playgroundOrigin = String(useRuntimeConfig().public.playgroundOrigin || '')

const { data: tests } = await useTests()
const { selectedId, selected } = useSelectedTest(tests)

// Undefined rather than '' when there is no test yet - '' is not a valid identifier and
// the API rejects it, which would show an error where "nothing here yet" is the truth.
const { data: submissions, refresh, status } = await useFetch<Submission[]>('/api/submissions', {
  query: { testId: computed(() => selectedId.value || undefined) },
})

const selectedSubmission = ref<Submission | null>(null)

// A submission from another test must not stay open in the review pane after switching.
watch(selectedId, () => { selectedSubmission.value = null })

function openAt(submission: Submission): string {
  return reviewUrl(playgroundOrigin, submission)
}

function submittedLabel(submission: Submission): string {
  if (!submission.submittedAt) return 'unknown (imported)'
  return new Date(submission.submittedAt).toLocaleString('nl-BE')
}
</script>

<template>
  <div>
    <TestPicker v-model="selectedId" :tests="tests" label="Showing submissions for" />

    <div class="split">
      <section class="panel">
        <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 12px">
          <h2 style="margin: 0">Submissions</h2>
          <button class="btn" type="button" :disabled="status === 'pending'" @click="refresh()">Refresh</button>
        </div>

        <p v-if="!tests?.length" class="muted">
          No tests yet. Create one on the Exam keys page, then issue keys for it.
        </p>

        <p v-else-if="!submissions?.length" class="muted">
          Nothing submitted for {{ selected?.label }} yet. Students post here from the
          playground with their exam key.
        </p>

        <div v-else class="scroll-y">
          <table>
            <caption class="muted" style="text-align:left; padding-bottom:8px">
              {{ submissions.length }} in {{ selected?.label }}, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Mode</th>
                <th scope="col">Submitted</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="submission in submissions"
                :key="submission.id"
                :aria-selected="selectedSubmission?.id === submission.id"
                style="cursor: pointer"
                @click="selectedSubmission = submission"
              >
                <td>
                  {{ submission.studentName }}
                  <br>
                  <code class="muted">{{ submission.examKey }}</code>
                </td>
                <td><span class="tag" :class="`tag-${submission.mode}`">{{ submission.mode }}</span></td>
                <td class="muted mono">{{ submittedLabel(submission) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div v-if="!selectedSubmission" class="muted">
          <h2>Review</h2>
          <p>Pick a submission to open it here.</p>
        </div>

        <div v-else class="stack">
          <div class="row" style="justify-content: space-between; align-items: center">
            <h2 style="margin: 0">{{ selectedSubmission.studentName }}</h2>
            <a class="btn" :href="openAt(selectedSubmission)" target="_blank" rel="noopener noreferrer">
              Open in a tab
            </a>
          </div>

          <!--
            Safe to embed because this frame is CROSS-ORIGIN: the playground runs on its own
            host, so student code cannot read this document, its cookies or its storage.
            allow-same-origin refers to the framed document's own origin, not ours.
            Crucially allow-top-navigation is absent, so nothing in there can retarget this
            admin tab at a page that looks like the login screen.
          -->
          <iframe
            :key="selectedSubmission.id"
            :src="openAt(selectedSubmission)"
            class="review-frame"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            :title="`Submission by ${selectedSubmission.studentName}`"
          />

          <p class="muted mono" style="word-break: break-all">
            Submitted link: {{ selectedSubmission.url }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
