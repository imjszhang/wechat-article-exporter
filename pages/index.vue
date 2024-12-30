<template>
  <div id="app" class="flex flex-col h-screen overflow-hidden">
    <Header
        @select:account="selectAccount"
        @search:article="searchArticle"
        @toggle:deleted="toggleDeleted"
    />
    <ArticleList 
        v-if="activeAccount" 
        :hide-deleted="hideDeleted" 
        ref="articleListRef" 
        class="flex-1 overflow-y-scroll"
    />
  </div>
</template>

<script setup lang="ts">
import type ArticleList from "~/components/ArticleList.vue";

definePageMeta({
  layout: false
});

useHead({
  title: '微信公众号文章导出'
});

// 全局状态：当前选中的公众号
const activeAccount = useActiveAccount();

// 引用文章列表组件
const articleListRef = ref<typeof ArticleList | null>(null);

// 是否隐藏已删除文章
const hideDeleted = ref(false);

// 切换隐藏已删除文章的状态
function toggleDeleted(hide: boolean) {
  hideDeleted.value = hide;
}

// 手动选择公众号时刷新文章列表
function selectAccount() {
  articleListRef.value?.init();
}

// 搜索文章时刷新文章列表
function searchArticle(query: string) {
  articleListRef.value?.init(query);
}

// 自动监听 activeAccount 的变化，刷新文章列表
watch(activeAccount, (newAccount) => {
  if (newAccount) {
    articleListRef.value?.init(); // 自动刷新文章列表
  }
});
</script>