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