<script setup lang="ts">
// A minimal two-step confirmation dialog (design doc M8: the history drawer's
// "clear all" needs a second confirmation, and FileDropZone's 1MB import guard
// switches to it in the same module). Built on n-modal rather than c-modal so
// the overlay stacks correctly when opened inside a drawer. Text props come
// from the caller, keeping the component i18n-agnostic like the rest of c-*.

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  content?: string
  confirmText?: string
  cancelText?: string
  type?: 'default' | 'primary' | 'warning' | 'error'
}>(), {
  open: false,
  title: '',
  content: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  type: 'primary',
});

const emit = defineEmits(['update:open', 'confirm', 'cancel']);

const isOpen = useVModel(props, 'open', emit, { passive: true });

function confirm() {
  emit('confirm');
  isOpen.value = false;
}

function cancel() {
  emit('cancel');
  isOpen.value = false;
}
</script>

<template>
  <n-modal
    v-model:show="isOpen"
    preset="card"
    :title="title"
    style="width: min(420px, calc(100vw - 32px))"
  >
    <p class="text-sm opacity-80">
      {{ content }}
    </p>
    <template #footer>
      <div flex justify-end gap-2>
        <c-button size="small" data-test-id="cancel" @click="cancel">
          {{ cancelText }}
        </c-button>
        <c-button size="small" :type="type" data-test-id="confirm" @click="confirm">
          {{ confirmText }}
        </c-button>
      </div>
    </template>
  </n-modal>
</template>
