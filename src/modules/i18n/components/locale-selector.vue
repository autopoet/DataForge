<script setup lang="ts">
const { locale } = useI18n();

// M12 U5: only zh/en are actively maintained (design doc §5.2); the seven
// legacy locale files stay in the repo but are hidden from the selector until
// their translations catch up.
const localesLong: Record<string, string> = {
  en: 'English',
  zh: '中文',
};

const localeOptions = computed(() =>
  Object.entries(localesLong).map(([value, label]) => ({ label, value })),
);

// A browser-preferred legacy locale (e.g. fr) is not selectable anymore —
// fall back to en instead of showing a value the list does not contain.
if (!localesLong[locale.value]) {
  locale.value = 'en';
}
</script>

<template>
  <c-select
    v-model:value="locale"
    :options="localeOptions"
    placeholder="Select a language"
    w-100px
  />
</template>
