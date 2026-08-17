<script setup lang="ts">
import * as monaco from 'monaco-editor';
import { useStyleStore } from '@/stores/style.store';

const props = withDefaults(
  defineProps<{
    options?: monaco.editor.IDiffEditorOptions
    original?: string
    modified?: string
    language?: string
  }>(),
  {
    options: () => ({}),
    original: '',
    modified: '',
    language: 'txt',
  },
);
const { options } = toRefs(props);

const editorContainer = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneDiffEditor | null = null;
let originalModel: monaco.editor.ITextModel | null = null;
let modifiedModel: monaco.editor.ITextModel | null = null;

monaco.editor.defineTheme('dataforge-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#00000000',
  },
});

monaco.editor.defineTheme('dataforge-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#00000000',
  },
});

const styleStore = useStyleStore();

watch(
  () => styleStore.isDarkTheme,
  isDarkTheme => monaco.editor.setTheme(isDarkTheme ? 'dataforge-dark' : 'dataforge-light'),
  { immediate: true },
);

// Phase 3 P1: the models are created once (in onMounted) and only rebuilt when
// the language changes; value updates call setValue on the live models so rapid
// typing does not leak editor instances.
watch(
  () => props.language,
  (language) => {
    if (!editor) {
      return;
    }
    originalModel?.dispose();
    modifiedModel?.dispose();
    originalModel = monaco.editor.createModel(props.original, language);
    modifiedModel = monaco.editor.createModel(props.modified, language);
    editor.setModel({ original: originalModel, modified: modifiedModel });
  },
);

watch([() => props.original, () => props.modified], ([original, modified]) => {
  if (originalModel && originalModel.getValue() !== original) {
    originalModel.setValue(original);
  }
  if (modifiedModel && modifiedModel.getValue() !== modified) {
    modifiedModel.setValue(modified);
  }
});

watch(
  () => options.value,
  options => editor?.updateOptions(options),
  { immediate: true, deep: true },
);

useResizeObserver(editorContainer, () => {
  editor?.layout();
});

onMounted(() => {
  if (!editorContainer.value) {
    return;
  }

  editor = monaco.editor.createDiffEditor(editorContainer.value, {
    originalEditable: true,
    minimap: {
      enabled: false,
    },
  });

  originalModel = monaco.editor.createModel(props.original, props.language);
  modifiedModel = monaco.editor.createModel(props.modified, props.language);
  editor.setModel({
    original: originalModel,
    modified: modifiedModel,
  });
});

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
  originalModel?.dispose();
  originalModel = null;
  modifiedModel?.dispose();
  modifiedModel = null;
});
</script>

<template>
  <div ref="editorContainer" h-600px />
</template>
