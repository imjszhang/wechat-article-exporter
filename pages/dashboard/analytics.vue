<template>
  <div class="flex flex-col h-full relative">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 font-bold">缓存分析</h1>
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

    <div class="flex flex-1 flex-col p-6 overflow-scroll space-y-4">
      <!-- 存储信息 -->
      <div class="p-4 bg-slate-100 rounded-lg shadow">
        <h2 class="text-lg font-semibold text-slate-800">存储信息</h2>
        <p class="mt-2 text-slate-600">
          本地数据库占用：<span class="text-rose-500">{{ usage }}</span>
        </p>
        <p class="text-slate-600">
          总存储容量：<span class="text-green-500">{{ quota }}</span>
        </p>
        <p class="text-slate-600">
          剩余存储容量：<span class="text-blue-500">{{ remaining }}</span>
        </p>
      </div>

      <!-- PocketBase 同步设置 -->
      <div class="p-4 bg-slate-100 rounded-lg shadow">
        <h2 class="text-lg font-semibold text-slate-800">PocketBase 同步设置</h2>
        <div class="mt-4 space-y-4">
          <!-- PocketBase 服务器地址 -->
          <div>
            <label for="pbServer" class="block text-sm font-medium text-slate-700">服务器地址</label>
            <input
              id="pbServer"
              v-model="pocketBaseConfig.server"
              type="text"
              class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="http://127.0.0.1:8090"
            />
          </div>

          <!-- Email -->
          <div>
            <label for="pbEmail" class="block text-sm font-medium text-slate-700">Email</label>
            <input
              id="pbEmail"
              v-model="pocketBaseConfig.email"
              type="email"
              class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="请输入 Email"
            />
          </div>

          <!-- 密码 -->
          <div>
            <label for="pbPassword" class="block text-sm font-medium text-slate-700">密码</label>
            <input
              id="pbPassword"
              v-model="pocketBaseConfig.password"
              type="password"
              class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="请输入密码"
            />
          </div>

          <!-- 保存按钮 -->
          <button
            @click="savePocketBaseConfig"
            class="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            保存设置
          </button>
        </div>
      </div>

      <!-- 数据库列表 -->
      <div v-if="databases.length > 0" class="space-y-4">
        <h2 class="text-lg font-semibold text-slate-800">数据库列表</h2>
        <div
          v-for="db in databases"
          :key="db.name"
          class="p-4 bg-white rounded-lg shadow flex flex-col space-y-2"
        >
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-md font-medium text-slate-800">{{ db.name }}</h3>
              <p class="text-sm text-slate-600">版本：{{ db.version }}</p>
              <p class="text-sm text-slate-600">大小：{{ db.size }} MB</p>
            </div>
            <button
              @click="exportSingleDatabase(db)"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              导出
            </button>
          </div>
          <div>
            <h4 class="text-sm font-semibold text-slate-700">对象存储列表</h4>
            <ul class="mt-2 space-y-1">
              <li
                v-for="store in db.objectStores"
                :key="store"
                class="flex justify-between items-center"
              >
                <span class="text-sm text-slate-600">{{ store }}</span>
                <div class="flex space-x-2">
                  <button
                    @click="exportSingleObjectStore(db, store)"
                    class="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                  >
                    导出
                  </button>
                  <button
                    v-if="store === 'info'"
                    @click="syncInfoObjectStore(db)"
                    class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    同步
                  </button>
                  <button
                    v-if="store === 'article'"
                    @click="syncArticleObjectStore(db)"
                    class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    同步
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div v-else class="text-slate-600">没有找到任何数据库。</div>

      <!-- 全部导出按钮 -->
      <button
        @click="exportAllDatabases"
        class="mt-4 px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
        :disabled="isExporting"
      >
        {{ isExporting ? "正在导出..." : "导出所有数据库" }}
      </button>
    </div>
  </div>

<div v-if="syncProgress.isSyncing" class="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
  <div class="text-center">
    <p class="text-slate-600 mb-4">正在同步数据，请稍候...</p>
    <div class="w-64 bg-gray-200 rounded-full h-4">
      <div
        class="bg-blue-500 h-4 rounded-full"
        :style="{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }"
      ></div>
    </div>
    <p class="text-slate-600 mt-2">
      已同步 {{ syncProgress.current }} / {{ syncProgress.total }} 条
    </p>
    <button
      @click="cancelSync"
      class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      取消同步
    </button>
  </div>
</div>

<div v-if="syncProgress.errors.length > 0" class="mt-4 p-4 bg-red-100 text-red-700 rounded">
  <h3 class="font-semibold">同步失败的记录：</h3>
  <ul class="list-disc pl-5">
    <li v-for="(error, index) in syncProgress.errors" :key="index">
      {{ error }}
    </li>
  </ul>
</div>
</template>

<script setup lang="ts">
useHead({
  title: '缓存分析 | 微信公众号文章导出'
});

import { login, getRecords, createRecord, updateRecord, deleteRecord } from '~/utils/pocketbase';

// 响应式变量
const usage = ref('');
const quota = ref('');
const remaining = ref('');
const databases = ref<{ name: string; version: number; size: string; objectStores: string[] }[]>([]);
const isLoading = ref(true); // 加载状态
const isExporting = ref(false); // 导出状态

const pocketBaseConfig = ref({
  server: localStorage.getItem('pbServer') || 'http://127.0.0.1:8090', // 服务器地址
  email: localStorage.getItem('pbEmail') || '', // Email
  password: localStorage.getItem('pbPassword') || '', // 密码
});

function savePocketBaseConfig() {
  try {
    // 保存到本地存储
    localStorage.setItem('pbServer', pocketBaseConfig.value.server);
    localStorage.setItem('pbEmail', pocketBaseConfig.value.email);
    localStorage.setItem('pbPassword', pocketBaseConfig.value.password);

    alert('PocketBase 配置信息已保存！');
  } catch (error) {
    console.error('保存 PocketBase 配置信息失败：', error);
    alert('保存失败，请检查控制台日志。');
  }
}


const syncProgress = ref({
  current: 0, // 当前已同步的条数
  total: 0,   // 总条数
  isSyncing: false, // 是否正在同步
  errors: [] as string[], // 记录同步失败的错误信息
  isCancelled: false, // 是否取消同步
});

function cancelSync() {
  syncProgress.value.isCancelled = true;
}

function convertTimestampToISO(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString(); // 时间戳是秒，需要乘以 1000 转为毫秒
}

function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);

    // 排序查询参数
    const params = new URLSearchParams(parsedUrl.search);
    const sortedParams = new URLSearchParams();
    Array.from(params.keys())
      .sort()
      .forEach(key => {
        sortedParams.append(key, params.get(key)!);
      });

    // 构造标准化 URL
    return `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/$/, '')}?${sortedParams.toString()}`;
  } catch (error) {
    console.error(`无法标准化 URL：${url}`, error);
    return url; // 如果解析失败，返回原始 URL
  }
}

async function syncArticleObjectStore(dbInfo: { name: string; version: number }) {
  try {
    const db = await openDatabase(dbInfo.name, dbInfo.version);
    const exportData = await exportObjectStore(db, 'article');

    // 初始化同步状态
    syncProgress.value.total = exportData.length;
    syncProgress.value.current = 0;
    syncProgress.value.isSyncing = true;
    syncProgress.value.errors = [];
    syncProgress.value.isCancelled = false;

    // 登录 PocketBase
    const loginSuccess = await login(pocketBaseConfig.value.email, pocketBaseConfig.value.password);
    if (!loginSuccess) {
      alert('登录 PocketBase 失败，请检查配置。');
      syncProgress.value.isSyncing = false;
      return;
    }

    const collectionName = 'wechat_articles';
    const existingRecords = await getRecords(collectionName);

    // 创建一个 Set 存储已存在的标准化 link，用于快速查找
    const existingLinks = new Set(existingRecords.map(record => normalizeUrl(record.link)));

    // 分页同步
    const batchSize = 100; // 每次同步 100 条
    for (let i = 0; i < exportData.length; i += batchSize) {
      if (syncProgress.value.isCancelled) {
        console.log('同步已取消');
        break;
      }

      const batch = exportData.slice(i, i + batchSize);

      for (const item of batch) {
        if (syncProgress.value.isCancelled) {
          console.log('同步已取消');
          break;
        }

        try {
          // 标准化当前记录的 link
          const normalizedLink = normalizeUrl(item.link);

          // 如果 link 已存在，跳过同步
          if (existingLinks.has(normalizedLink)) {
            syncProgress.value.current++;
            continue;
          }

          // 映射字段并转换 update_time
          const mappedData = {
            title: item.title,
            link: item.link, 
            cover: item.cover,
            update_time: convertTimestampToISO(item.update_time),
            digest: item.digest,
            author_name: item.author_name,
            is_deleted: item.is_deleted,
            fakeid: item.fakeid,
          };

          // 创建新记录
          await createRecord(collectionName, mappedData);

          // 更新进度
          syncProgress.value.current++;
        } catch (error) {
          // 记录错误信息
          syncProgress.value.errors.push(`同步失败：${item.link}，错误：${error.message}`);
          console.error(`同步失败：${item.link}`, error);
        }
      }
    }

    // 显示同步结果
    const successCount = syncProgress.value.current;
    const errorCount = syncProgress.value.errors.length;
    alert(`同步完成！成功：${successCount} 条，失败：${errorCount} 条`);
  } catch (error) {
    console.error('同步 article 对象存储失败：', error);
    alert('同步 article 对象存储失败，请检查控制台日志。');
  } finally {
    syncProgress.value.isSyncing = false;
  }
}

async function syncInfoObjectStore(dbInfo: { name: string; version: number }) {
  try {
    // 打开数据库并导出 info 对象存储数据
    const db = await openDatabase(dbInfo.name, dbInfo.version);
    const exportData = await exportObjectStore(db, 'info');

    // 登录 PocketBase
    const loginSuccess = await login(pocketBaseConfig.value.email, pocketBaseConfig.value.password);
    if (!loginSuccess) {
      alert('登录 PocketBase 失败，请检查配置。');
      return;
    }

    // 获取 PocketBase 中 wechat_public_accounts 集合的现有记录
    const collectionName = 'wechat_public_accounts';
    const existingRecords = await getRecords(collectionName);

    // 同步数据
    for (const item of exportData) {
      // 映射字段
      const mappedData = {
        fakeid: item.fakeid,
        nickname: item.nickname,
        round_head_img: item.round_head_img,
      };

      // 检查是否已存在
      const existingRecord = existingRecords.find(record => record.fakeid === item.fakeid);
      if (existingRecord) {
        // 更新记录
        await updateRecord(collectionName, existingRecord.id, mappedData);
      } else {
        // 创建新记录
        await createRecord(collectionName, mappedData);
      }
    }

    alert('info 对象存储同步成功！');
  } catch (error) {
    console.error('同步 info 对象存储失败：', error);
    alert('同步 info 对象存储失败，请检查控制台日志。');
  }
}


async function calculateStorageInfo() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0; // 已使用存储空间
      const total = estimate.quota || 0; // 总存储容量

      usage.value = (used / 1024 / 1024).toFixed(2) + ' MB'; // 转换为 MB
      quota.value = (total / 1024 / 1024).toFixed(2) + ' MB'; // 转换为 MB
      remaining.value = ((total - used) / 1024 / 1024).toFixed(2) + ' MB'; // 剩余存储容量
    } catch (error) {
      console.error("获取存储信息失败：", error);
      usage.value = '未知';
      quota.value = '未知';
      remaining.value = '未知';
    }
  } else {
    console.warn("浏览器不支持存储估算 API。");
    usage.value = '不支持';
    quota.value = '不支持';
    remaining.value = '不支持';
  }
}

async function calculateDatabaseSize(db: IDBDatabase): Promise<number> {
  let totalSize = 0; // 总大小（以 MB 为单位）

  for (const storeName of db.objectStoreNames) {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor(); // 使用游标逐条读取数据

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            // 将当前记录的大小累加到总大小
            totalSize += JSON.stringify(cursor.value).length / 1024 / 1024; // 转换为 MB
            cursor.continue(); // 移动到下一条记录
          } else {
            // 游标遍历完成
            resolve();
          }
        };

        request.onerror = () => {
          console.error(`读取对象存储 ${storeName} 失败：`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`计算对象存储 ${storeName} 大小失败：`, error);
    }
  }

  return totalSize; // 返回总大小
}

// 初始化函数
async function init() {
  try {
    isLoading.value = true;

    // 计算存储信息
    await calculateStorageInfo();

    // 检查浏览器支持
    if (!('indexedDB' in window)) {
      alert("您的浏览器不支持 IndexedDB，请更换浏览器后重试。");
      return;
    }

    // 获取数据库列表
    const dbs = [];
    if ('databases' in indexedDB) {
      dbs.push(...(await indexedDB.databases()));
    } else {
      console.warn("indexedDB.databases() 不可用，尝试直接打开默认数据库。");
      dbs.push({ name: "default", version: 1 });
    }

    databases.value = await Promise.all(
      dbs.map(async (dbInfo) => {
        try {
          const db = await openDatabase(dbInfo.name!, dbInfo.version!);
          const size = await calculateDatabaseSize(db);
          return {
            name: dbInfo.name!,
            version: dbInfo.version!,
            size: size.toFixed(2),
            objectStores: Array.from(db.objectStoreNames),
          };
        } catch (error) {
          console.error(`无法获取数据库 ${dbInfo.name} 的信息：`, error);
          return {
            name: dbInfo.name!,
            version: dbInfo.version!,
            size: "未知",
            objectStores: [],
          };
        }
      })
    );
  } catch (error) {
    console.error("初始化失败：", error);
    alert("加载数据失败，请检查控制台日志。");
  } finally {
    isLoading.value = false;
  }
}

// 页面加载时初始化
await init();

function openDatabase(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(name, version);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error(`打开数据库 ${name} 失败：`, request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error(`无法打开数据库 ${name}：`, error);
      reject(error);
    }
  });
}

function exportObjectStore(db: IDBDatabase, storeName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const data: any[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor.continue();
        } else {
          resolve(data);
        }
      };

      request.onerror = () => {
        console.error(`读取对象存储 ${storeName} 失败：`, request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error("导出对象存储失败：", error);
      reject(error);
    }
  });
}

async function exportSingleObjectStore(dbInfo: { name: string; version: number }, storeName: string) {
  try {
    const db = await openDatabase(dbInfo.name, dbInfo.version);
    const exportData = await exportObjectStore(db, storeName);
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dbInfo.name}_${storeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(`导出对象存储 ${storeName} 失败：`, error);
    alert(`导出对象存储 ${storeName} 失败，请检查控制台日志。`);
  }
}

function exportToJson(db: IDBDatabase): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(db.objectStoreNames, 'readonly'); // 创建只读事务
      const exportData: any = {}; // 用于存储导出的数据
      let count = db.objectStoreNames.length; // 记录需要处理的对象存储数量

      transaction.oncomplete = () => resolve(exportData); // 当事务完成时，返回导出的数据
      transaction.onerror = () => {
        console.error("事务失败：", transaction.error);
        reject(transaction.error); // 如果事务失败，返回错误
      };

      for (const storeName of db.objectStoreNames) {
        const store = transaction.objectStore(storeName); // 获取对象存储
        const data: any[] = []; // 用于存储当前对象存储的数据
        const request = store.openCursor(); // 使用游标读取数据

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            data.push(cursor.value); // 将当前记录添加到数组
            cursor.continue(); // 移动到下一条记录
          } else {
            // 游标遍历完成
            exportData[storeName] = data; // 将对象存储的数据添加到导出结果中
            if (--count === 0) resolve(exportData); // 如果所有对象存储都处理完，返回结果
          }
        };

        request.onerror = () => {
          console.error(`读取对象存储 ${storeName} 失败：`, request.error);
          exportData[storeName] = []; // 即使失败，也返回空数组
          if (--count === 0) resolve(exportData); // 如果所有对象存储都处理完，返回结果
        };
      }
    } catch (error) {
      console.error("导出数据库失败：", error);
      reject(error); // 如果发生错误，返回错误
    }
  });
}

async function exportSingleDatabase(dbInfo: { name: string; version: number }) {
  try {
    const db = await openDatabase(dbInfo.name, dbInfo.version);
    const exportData = await exportToJson(db);
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dbInfo.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(`导出数据库 ${dbInfo.name} 失败：`, error);
    alert(`导出数据库 ${dbInfo.name} 失败，请检查控制台日志。`);
  }
}

async function exportAllDatabases() {
  isExporting.value = true;
  for (const db of databases.value) {
    try {
      await exportSingleDatabase(db);
    } catch (error) {
      console.error(`导出数据库 ${db.name} 失败：`, error);
    }
  }
  isExporting.value = false;
  alert("所有数据库导出完成！");
}
</script>