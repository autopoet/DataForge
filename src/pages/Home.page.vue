<script setup lang="ts">
import { IconDragDrop } from '@tabler/icons-vue';
import { useHead } from '@vueuse/head';
import { computed } from 'vue';
import Draggable from 'vuedraggable';
import ToolCard from '../components/ToolCard.vue';
import { useToolStore } from '@/tools/tools.store';

// M12 (design doc U1): the hero is down to the title + the workbench primary
// action; type-generator is a quiet text link. Below: favorites area and the
// compact catalog grouped by category.

const toolStore = useToolStore();

useHead({ title: 'DataForge - Frontend data workbench' });
const { t } = useI18n();

const favoriteTools = computed(() => toolStore.favoriteTools);
const allToolCategories = computed(() => toolStore.toolsByCategory);

// Update favorite tools order when drag is finished
function onUpdateFavoriteTools() {
  toolStore.updateFavoriteTools(favoriteTools.value); // Update the store with the new order
}
</script>

<template>
  <div class="pt-50px">
    <div>
      <section class="hero text-center">
        <h1 class="m-0 text-4xl text-black font-600 dark:text-white">
          DataForge
        </h1>

        <div class="mt-5 flex flex-wrap items-center justify-center gap-x-16px gap-y-8px">
          <c-button size="large" type="primary" to="/workbench" data-test-id="hero-open-workbench">
            {{ t('home.hero.openWorkbench') }}
          </c-button>
          <router-link
            to="/type-generator"
            class="text-base text-neutral-500 underline-offset-4px decoration-none transition-colors dark:text-neutral-400 hover:text-primary hover:underline"
            data-test-id="hero-open-type-generator"
          >
            {{ t('home.hero.openTypeGenerator') }} →
          </router-link>
        </div>
      </section>

      <transition name="height">
        <div v-if="toolStore.favoriteTools.length > 0">
          <h3 class="mb-5px mt-25px text-neutral-400 font-500">
            {{ $t('home.categories.favoriteTools') }}
            <c-tooltip :tooltip="$t('home.categories.favoritesDndToolTip')">
              <n-icon :component="IconDragDrop" size="18" />
            </c-tooltip>
          </h3>
          <Draggable
            :list="favoriteTools"
            class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4"
            ghost-class="ghost-favorites-draggable"
            item-key="name"
            @end="onUpdateFavoriteTools"
          >
            <template #item="{ element: tool }">
              <ToolCard :tool="tool" />
            </template>
          </Draggable>
        </div>
      </transition>

      <h3 class="mb-5px mt-25px text-neutral-400 font-500">
        {{ $t('home.categories.allTools') }}
      </h3>
      <div v-for="category in allToolCategories" :key="category.name" class="mb-15px">
        <div class="mb-8px text-sm text-neutral-400 font-500">
          {{ category.name }}
        </div>
        <div class="grid grid-cols-2 gap-8px lg:grid-cols-4 md:grid-cols-3">
          <router-link
            v-for="tool in category.components"
            :key="tool.path"
            :to="tool.path"
            class="compact-tool flex items-center gap-8px border-1px border-neutral-200 rounded border-solid px-10px py-6px text-black decoration-none transition transition-duration-0.5s dark:border-neutral-800 hover:border-primary dark:text-white"
          >
            <n-icon class="shrink-0 text-neutral-400 dark:text-neutral-600" size="18" :component="tool.icon" />
            <span class="truncate">{{ tool.name }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.height-enter-active,
.height-leave-active {
  transition: all 0.5s ease-in-out;
  overflow: hidden;
  max-height: 500px;
}

.height-enter-from,
.height-leave-to {
  max-height: 42px;
  overflow: hidden;
  opacity: 0;
  margin-bottom: 0;
}

.ghost-favorites-draggable {
  opacity: 0.4;
  background-color: #ccc;
  border: 2px dashed #666;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  transform: scale(1.1);
  animation: ghost-favorites-draggable-animation 0.2s ease-out;
}

@keyframes ghost-favorites-draggable-animation {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 0.4;
    transform: scale(1.0);
  }
}
</style>
