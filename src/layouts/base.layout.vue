<script lang="ts" setup>
import { NIcon, useThemeVars } from 'naive-ui';

import { RouterLink } from 'vue-router';
import { IconBrush, IconFlame, IconHome2, IconMenu2 } from '@tabler/icons-vue';

import { storeToRefs } from 'pinia';
import MenuLayout from '../components/MenuLayout.vue';
import NavbarButtons from '../components/NavbarButtons.vue';
import { useStyleStore } from '@/stores/style.store';
import { config } from '@/config';
import type { ToolCategory } from '@/tools/tools.types';
import { useToolStore } from '@/tools/tools.store';
import CollapsibleToolMenu from '@/components/CollapsibleToolMenu.vue';

const themeVars = useThemeVars();
const styleStore = useStyleStore();
const version = config.app.version;
const commitSha = config.app.lastCommitSha.slice(0, 7);

const { t } = useI18n();

const toolStore = useToolStore();
const { favoriteTools, toolsByCategory } = storeToRefs(toolStore);

const tools = computed<ToolCategory[]>(() => [
  ...(favoriteTools.value.length > 0 ? [{ name: t('tools.categories.favorite-tools'), components: favoriteTools.value }] : []),
  ...toolsByCategory.value,
]);
</script>

<template>
  <MenuLayout class="menu-layout" :class="{ isSmallScreen: styleStore.isSmallScreen }">
    <template #sider>
      <RouterLink to="/" class="brand-header" aria-label="DataForge">
        <IconFlame class="brand-logo" />
        <span class="brand-name">DataForge</span>
      </RouterLink>

      <div class="sider-content">
        <div v-if="styleStore.isSmallScreen" flex flex-col items-center>
          <locale-selector w="90%" />

          <div flex justify-center>
            <NavbarButtons />
          </div>
        </div>

        <CollapsibleToolMenu :tools-by-category="tools" />

        <div class="footer">
          <c-tooltip
            v-if="version && version !== '0.0.0'"
            :tooltip="`v${version}${commitSha ? ` (${commitSha})` : ''}`"
            position="top"
          >
            <span>© {{ new Date().getFullYear() }} DataForge</span>
          </c-tooltip>
          <span v-else>© {{ new Date().getFullYear() }} DataForge</span>
        </div>
      </div>
    </template>

    <template #content>
      <div flex items-center justify-center gap-2>
        <c-button
          circle
          variant="text"
          :aria-label="$t('home.toggleMenu')"
          @click="styleStore.isMenuCollapsed = !styleStore.isMenuCollapsed"
        >
          <NIcon size="25" :component="IconMenu2" />
        </c-button>

        <c-tooltip :tooltip="$t('home.home')" position="bottom">
          <c-button to="/" circle variant="text" :aria-label="$t('home.home')">
            <NIcon size="25" :component="IconHome2" />
          </c-button>
        </c-tooltip>

        <c-tooltip :tooltip="$t('home.uiLib')" position="bottom">
          <c-button v-if="config.app.env === 'development'" to="/c-lib" circle variant="text" :aria-label="$t('home.uiLib')">
            <NIcon size="25" :component="IconBrush" />
          </c-button>
        </c-tooltip>

        <command-palette />

        <locale-selector v-if="!styleStore.isSmallScreen" />

        <div>
          <NavbarButtons v-if="!styleStore.isSmallScreen" />
        </div>
      </div>
      <slot />
    </template>
  </MenuLayout>
</template>

<style lang="less" scoped>
.footer {
  text-align: center;
  color: #838587;
  margin-top: 20px;
  padding: 20px 0;
  font-size: 12px;
}

.sider-content {
  padding-top: 4px;
}

.brand-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 56px;
  width: 100%;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  text-decoration: none;

  .brand-logo {
    width: 26px;
    height: 26px;
    color: v-bind('themeVars.primaryColor');
  }

  .brand-name {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
}
</style>
