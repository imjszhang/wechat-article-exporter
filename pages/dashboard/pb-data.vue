<template>
    <div class="flex flex-col h-full">
      <Teleport defer to="#title">
        <h1 class="text-[28px] leading-[34px] text-slate-12 font-bold">
          PB数据 <span class="text-sm text-slate-10">从 PocketBase 获取公众号数据</span>
        </h1>
      </Teleport>
  
      <!-- 加载状态 -->
      <div
        v-if="isLoading"
        class="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50"
      >
        <div class="text-center">
          <div class="loader mb-4"></div>
          <p class="text-slate-600">正在加载数据，请稍候...</p>
        </div>
      </div>
  
      <div class="flex flex-1 overflow-hidden">
        <!-- 公众号列表 -->
        <div class="flex flex-col h-full w-fit overflow-y-scroll divide-y">
          <!-- 搜索框 -->
          <div class="p-4">
            <UInput
              v-model="searchKeyword"
              placeholder="搜索公众号"
              color="blue"
              class="w-full"
            />
          </div>
  
          <!-- 公众号列表 -->
          <ul>
            <li
              v-for="account in filteredAccounts"
              :key="account.id"
              class="relative px-4 pr-16 py-4 hover:bg-slate-3 hover:cursor-pointer transition"
              :class="{ 'bg-slate-3': selectedAccount === account.id }"
              @click="selectAccount(account)"
            >
              <p>
                公众号:
                <span v-if="account.nickname" class="text-xl font-medium">
                  {{ account.nickname }}
                </span>
              </p>
              <p>ID: <span class="font-mono">{{ account.id }}</span></p>
              <UBadge variant="subtle" color="green" class="absolute top-4 right-2">
                {{ account.articles }}
              </UBadge>
            </li>
          </ul>
  
          <!-- 无结果提示 -->
          <div
            v-if="filteredAccounts.length === 0"
            class="p-4 text-center text-gray-500"
          >
            未找到相关公众号
          </div>
        </div>
  
        <!-- 文章列表 -->
        <main class="flex-1 h-full overflow-y-scroll">
          <div v-if="isLoadingArticles" class="flex justify-center items-center mt-5">
            <Loader :size="28" class="animate-spin text-slate-500" />
          </div>
          <div v-else-if="selectedAccount">
            <div class="sticky top-0 z-50 bg-white flex justify-between items-center px-4 h-[40px]">
              <div class="flex items-center space-x-4">
                <UButton
                  color="blue"
                  variant="solid"
                  :disabled="!selectedAccount"
                  @click="setActiveAccount"
                >
                  切换为活动账号
                </UButton>
              </div>
            </div>
            <table class="w-full border-collapse">
              <thead class="sticky top-[40px] z-10 h-[40px] bg-white">
                <tr>
                  <th class="w-14">序号</th>
                  <th>标题</th>
                  <th class="w-52">发布日期</th>
                  <th>作者</th>
                  <th class="w-24">是否原创</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(article, index) in articles" :key="article.id">
                  <td class="text-center font-mono">{{ index + 1 }}</td>
                  <td class="px-4 font-mono">{{ maxLen(article.title) }}</td>
                  <td class="text-center font-mono">{{ formatTimeStamp(article.update_time) }}</td>
                  <td class="text-center">{{ article.author_name }}</td>
                  <td class="text-center">
                    {{ article.is_original ? '原创' : '非原创' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue';
  import { login, getRecords } from '~/utils/pocketbase';
  import { Loader } from 'lucide-vue-next';
  import { formatTimeStamp } from '~/utils';
  
  // PocketBase 配置
  const pocketBaseConfig = reactive({
    server: localStorage.getItem('pbServer') || 'http://127.0.0.1:8090',
    email: localStorage.getItem('pbEmail') || '',
    password: localStorage.getItem('pbPassword') || '',
  });
  
  // 数据存储
  const accounts = ref([]);
  const articles = ref([]);
  const isLoading = ref(true);
  const isLoadingArticles = ref(false);
  
  // 搜索关键词
  const searchKeyword = ref('');
  
  // 过滤后的公众号列表
  const filteredAccounts = computed(() => {
    if (!searchKeyword.value.trim()) {
      return accounts.value;
    }
    return accounts.value.filter(
      (account) =>
        account.nickname?.includes(searchKeyword.value.trim()) ||
        account.id.includes(searchKeyword.value.trim())
    );
  });
  
  // 当前选中的公众号
  const selectedAccount = ref(null);
  
  // 登录 PocketBase
  async function loginPocketBase() {
    try {
      const success = await login(pocketBaseConfig.email, pocketBaseConfig.password);
      if (!success) {
        alert('登录 PocketBase 失败，请检查配置。');
        return false;
      }
      return true;
    } catch (error) {
      console.error('登录 PocketBase 失败：', error);
      alert('登录 PocketBase 失败，请检查控制台日志。');
      return false;
    }
  }
  
  // 获取公众号数据
  async function fetchAccounts() {
    try {
      isLoading.value = true;
  
      // 确保登录成功
      const isLoggedIn = await loginPocketBase();
      if (!isLoggedIn) return;
  
      const records = await getRecords('wechat_public_accounts');
      accounts.value = records.map((record) => ({
        id: record.fakeid,
        nickname: record.nickname,
        articles: record.articles_count || 0,
      }));
    } catch (error) {
      console.error('获取公众号数据失败：', error);
    } finally {
      isLoading.value = false;
    }
  }
  
  // 获取文章数据
  async function fetchArticles(accountId) {
    try {
      isLoadingArticles.value = true;
  
      // 确保登录成功
      const isLoggedIn = await loginPocketBase();
      if (!isLoggedIn) return;
  
      const records = await getRecords('wechat_articles', 1, 100, {
        filter: `fakeid="${accountId}"`,
      });
      articles.value = records.map((record) => ({
        id: record.id,
        title: record.title,
        update_time: record.update_time,
        author_name: record.author_name || '--',
        is_original: record.is_original || false,
      }));
    } catch (error) {
      console.error('获取文章数据失败：', error);
    } finally {
      isLoadingArticles.value = false;
    }
  }
  
  // 选择公众号
  function selectAccount(account) {
    if (account.id !== selectedAccount.value) {
      selectedAccount.value = account.id;
      fetchArticles(account.id);
    }
  }
  
  // 设置为活动账号
  function setActiveAccount() {
    if (!selectedAccount.value) return;
    const account = accounts.value.find((acc) => acc.id === selectedAccount.value);
    if (account) {
      alert(`已将账号 "${account.nickname}" 设置为活动账号`);
    }
  }
  
  // 工具函数
  function maxLen(text, max = 35) {
    return text.length > max ? text.slice(0, max) + '...' : text;
  }
  
  // 初始化
  onMounted(() => {
    fetchAccounts();
  });
  </script>
  
  <style scoped>
  table th {
    padding: 0.5rem 0.25rem;
  }
  
  table td {
    border: 1px solid #00002d17;
    padding: 0.25rem 0.5rem;
  }
  
  td:first-child,
  th:first-child {
    border-left: none;
  }
  
  td:last-child,
  th:last-child {
    border-right: none;
  }
  
  th {
    border: 1px solid #00002d17;
    border-top: none;
  }
  
  tr:nth-child(even) {
    background-color: #00005506;
  }
  
  tr:hover {
    background-color: #00005506;
  }
  </style>