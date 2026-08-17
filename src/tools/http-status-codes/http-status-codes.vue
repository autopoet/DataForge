<script setup lang="ts">
import { codesByCategories } from './http-status-codes.constants';
import { codesByCategoriesZh } from './http-status-codes.constants.zh';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const { t, locale } = useI18n();

const search = ref('');

const codesByCategoriesLocalized = computed(() => locale.value === 'zh' ? codesByCategoriesZh : codesByCategories);

const { searchResult } = useFuzzySearch({
  search,
  data: computed(() => codesByCategoriesLocalized.value.flatMap(({ codes, category }) => codes.map(code => ({ ...code, category })))),
  options: {
    keys: [{ name: 'code', weight: 3 }, { name: 'name', weight: 2 }, 'description', 'category'],
  },
});

const codesByCategoryFiltered = computed(() => {
  if (!search.value) {
    return codesByCategoriesLocalized.value;
  }

  return [{ category: t('tools.http-status-codes.searchResults'), codes: searchResult.value }];
});
</script>

<template>
  <div>
    <c-input-text
      v-model:value="search"
      :placeholder="t('tools.http-status-codes.searchPlaceholder')"
      autofocus raw-text mb-10
    />

    <div v-for="{ codes, category } of codesByCategoryFiltered" :key="category" mb-8>
      <div mb-2 text-xl>
        {{ category }}
      </div>

      <c-card v-for="{ code, description, name, type } of codes" :key="code" mb-2>
        <div text-lg font-bold>
          {{ code }} {{ name }}
        </div>
        <div op-70>
          {{ description }} {{ type !== 'HTTP' ? t('tools.http-status-codes.forType', { type }) : '' }}
        </div>
      </c-card>
    </div>
  </div>
</template>
