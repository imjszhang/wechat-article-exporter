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
  
                <span>过滤条件:</span>
                <UInput v-model="query.title" placeholder="请输入标题过滤" color="blue" />
  
                <USelectMenu
                  class="w-40"
                  color="blue"
                  v-model="query.authors"
                  :options="articleAuthors"
                  multiple
                  placeholder="选择作者"
                />
  
                <USelect v-model="query.isOriginal" :options="originalOptions" color="blue" />
  
                <UButton color="gray" variant="solid" @click="search">搜索</UButton>
              </div>
              <div class="space-x-2">
                <UButton
                  color="black"
                  variant="solid"
                  class="disabled:bg-slate-4 disabled:text-slate-12"
                  :disabled="selectedArticles.length === 0 || excelBtnLoading"
                  @click="excelExport"
                >
                  导出Excel
                </UButton>
              </div>
            </div>
            <table class="w-full border-collapse">
              <thead class="sticky top-[40px] z-10 h-[40px] bg-white">
                <tr>
                  <th>
                    <UCheckbox
                      class="justify-center"
                      :indeterminate="isIndeterminate"
                      v-model="checkAll"
                      @change="onCheckAllChange"
                      color="blue"
                    />
                  </th>
                  <th class="w-14">序号</th>
                  <th>标题</th>
                  <th class="w-52">发布日期</th>
                  <th>作者</th>
                  <th class="w-24">是否原创</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(article, index) in displayedArticles" :key="article.id">
                  <td class="text-center" @click="toggleArticleCheck(article)">
                    <UCheckbox class="justify-center" v-model="article.checked" color="blue" />
                  </td>
                  <td class="text-center font-mono">{{ index + 1 }}</td>
                  <td class="px-4 font-mono">{{ maxLen(article.title) }}</td>
                  <td class="text-center font-mono">{{ article.update_time }}</td>
                  <td class="text-center">{{ article.author_name }}</td>
                  <td class="text-center">
                    {{ article.is_original ? '原创' : '非原创' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <!-- 状态栏 -->
            <div class="sticky bottom-0 h-[40px] bg-white flex items-center px-4 space-x-10 border-t-2 font-mono">
              <span class="text-green-500">已选 {{ selectedArticles.length }} / {{ displayedArticles.length }}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue';
  import { login, getRecords } from '~/utils/pocketbase';
  import { Loader } from 'lucide-vue-next';
  import ExcelJS from 'exceljs';
  import { saveAs } from 'file-saver';
  
  // PocketBase 配置
  const pocketBaseConfig = reactive({
    server: localStorage.getItem('pbServer') || 'http://127.0.0.1:8090',
    email: localStorage.getItem('pbEmail') || '',
    password: localStorage.getItem('pbPassword') || '',
  });
  
  // 数据存储
  const accounts = ref([]);
  const articles = reactive([]);
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
  
  // 获取所有记录的方法（支持筛选）
  async function getAllRecords(collectionName: string, filter: string = ''): Promise<any[]> {
    const allRecords: any[] = [];
    let page = 1;
    const perPage = 1000; // 每页记录数
  
    while (true) {
      const records = await getRecords(collectionName, page, perPage, { filter });
      allRecords.push(...records);
  
      // 如果当前页的记录数小于每页记录数，说明已到最后一页
      if (records.length < perPage) {
        break;
      }
  
      page++;
    }
  
    console.log(`从集合 ${collectionName} 中获取了 ${allRecords.length} 条记录，筛选条件: ${filter}`);
    return allRecords;
  }
  
  // 获取公众号数据
  async function fetchAccounts() {
    try {
      isLoading.value = true;
  
      // 确保登录成功
      const isLoggedIn = await loginPocketBase();
      if (!isLoggedIn) return;
  
      const records = await getAllRecords('wechat_public_accounts'); // 不需要筛选条件
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
  
      // 使用筛选条件获取文章数据
      const filter = `fakeid="${accountId}"`;
      const records = await getAllRecords('wechat_articles', filter);
      articles.length = 0;
      articles.push(
        ...records.map((record) => ({
          id: record.id,
          title: record.title,
          update_time: record.update_time,
          author_name: record.author_name || '--',
          is_original: record.is_original || false,
          checked: false,
          display: true,
        }))
      );
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
  
  // 筛选功能
  const query = reactive({
    title: '',
    authors: [],
    isOriginal: '所有',
  });
  
  const articleAuthors = computed(() => {
    return [...new Set(articles.map((article) => article.author_name).filter((author) => !!author))];
  });
  
  const originalOptions = ['原创', '非原创', '所有'];
  
  function search() {
    articles.forEach((article) => {
      article.display = true;
  
      if (query.title && !article.title.includes(query.title)) {
        article.display = false;
      }
      if (query.authors.length > 0 && !query.authors.includes(article.author_name)) {
        article.display = false;
      }
      if (query.isOriginal === '原创' && !article.is_original) {
        article.display = false;
      }
      if (query.isOriginal === '非原创' && article.is_original) {
        article.display = false;
      }
    });
  }
  
  // 导出 Excel
  const excelBtnLoading = ref(false);
  
  function excelExport() {
    excelBtnLoading.value = true;
  
    const data = articles.filter((article) => article.checked && article.display);
    setTimeout(() => {
      exportToExcel(data);
      excelBtnLoading.value = false;
    }, 0);
  }
  
  async function exportToExcel(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
  
    worksheet.columns = [
      { header: '标题', key: 'title', width: 80 },
      { header: '发布日期', key: 'update_time', width: 20 },
      { header: '作者', key: 'author_name', width: 20 },
      { header: '是否原创', key: 'is_original', width: 10 },
    ];
  
    data.forEach((item) => {
      worksheet.addRow({
        title: item.title,
        update_time: item.update_time,
        author_name: item.author_name,
        is_original: item.is_original ? '原创' : '非原创',
      });
    });
  
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, '导出数据.xlsx');
  }
  
  // 全选功能
  const checkAll = ref(false);
  const isIndeterminate = ref(false);
  
  const displayedArticles = computed(() => {
    return articles.filter((article) => article.display);
  });
  
  const selectedArticles = computed(() => {
    return articles.filter((article) => article.checked && article.display);
  });
  
  function toggleArticleCheck(article) {
    article.checked = !article.checked;
  
    if (articles.every((article) => article.checked)) {
      checkAll.value = true;
      isIndeterminate.value = false;
    } else if (articles.every((article) => !article.checked)) {
      checkAll.value = false;
      isIndeterminate.value = false;
    } else {
      isIndeterminate.value = true;
      checkAll.value = false;
    }
  }
  
  function onCheckAllChange() {
    if (checkAll.value) {
      articles.forEach((article) => {
        article.checked = true;
      });
      isIndeterminate.value = false;
    } else {
      articles.forEach((article) => {
        article.checked = false;
      });
      isIndeterminate.value = false;
    }
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