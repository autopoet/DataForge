<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { useHead } from '@vueuse/head';
import type { HeadObject } from '@vueuse/head';

import BaseLayout from './base.layout.vue';
import FavoriteButton from '@/components/FavoriteButton.vue';
import type { Tool } from '@/tools/tools.types';

const route = useRoute();

const head = computed<HeadObject>(() => ({
  title: `${route.meta.name} - DataForge`,
  meta: [
    {
      name: 'description',
      content: route.meta?.description as string,
    },
    {
      name: 'keywords',
      content: ((route.meta.keywords ?? []) as string[]).join(','),
    },
  ],
}));
useHead(head);
const { t } = useI18n();

const i18nKey = computed<string>(() => route.path.trim().replace('/', ''));
const toolTitle = computed<string>(() => t(`tools.${i18nKey.value}.title`, String(route.meta.name)));
</script>

<template>
  <BaseLayout>
    <div class="tool-layout">
      <div class="tool-header">
        <div flex flex-nowrap items-center justify-between>
          <h1 class="tool-title">
            {{ toolTitle }}
          </h1>

          <div>
            <FavoriteButton :tool="{ name: route.meta.name, path: route.path } as Tool" />
          </div>
        </div>
      </div>
    </div>

    <div class="tool-content">
      <slot />
    </div>
  </BaseLayout>
</template>

<style lang="less" scoped>
.tool-content {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;

  ::v-deep(& > *) {
    flex: 0 1 600px;
  }
}

.tool-layout {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;

  .tool-header {
    padding: 20px 0;
    width: 100%;

    .tool-title {
      opacity: 0.9;
      font-size: 22px;
      font-weight: 500;
      margin: 0;
      line-height: 1.2;
    }
  }
}
</style>
