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

      <!-- 数据库列表 -->
      <div v-if="databases.length > 0" class="space-y-4">
        <h2 class="text-lg font-semibold text-slate-800">数据库列表</h2>
        <div
          v-for="db in databases"
          :key="db.name"
          class="p-4 bg-white rounded-lg shadow flex justify-between items-center"
        >
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
</template>

<script setup lang="ts">
useHead({
  title: '缓存分析 | 微信公众号文章导出'
});

const usage = ref('');
const quota = ref('');
const remaining = ref('');
const databases = ref<{ name: string; version: number; size: string }[]>([]);
const isLoading = ref(true); // 新增：加载状态
const isExporting = ref(false);

async function init() {
  try {
    isLoading.value = true;

    // 检查浏览器支持
    if (!('indexedDB' in window)) {
      alert("您的浏览器不支持 IndexedDB，请更换浏览器后重试。");
      return;
    }

    // 检查隐私模式
    const isPrivateMode = await detectPrivateMode();
    if (isPrivateMode) {
      alert("您当前处于隐私模式，IndexedDB 功能可能无法正常使用。");
      return;
    }

    // 检查存储配额
    const storageUsage = await navigator.storage.estimate();
    if (storageUsage.usage >= storageUsage.quota) {
      alert("存储空间已满，请清理浏览器缓存后重试。");
      return;
    }

    // 获取存储信息
    const usedSize = (storageUsage.usage! / 1024 / 1024).toFixed(2);
    const totalSize = (storageUsage.quota! / 1024 / 1024).toFixed(2);
    const remainingSize = (storageUsage.quota! - storageUsage.usage!) / 1024 / 1024;

    usage.value = usedSize + ' MB';
    quota.value = totalSize + ' MB';
    remaining.value = remainingSize.toFixed(2) + ' MB';

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
        const db = await openDatabase(dbInfo.name!, dbInfo.version!);
        const size = await calculateDatabaseSize(db);
        return {
          name: dbInfo.name!,
          version: dbInfo.version!,
          size: size.toFixed(2),
        };
      })
    );
  } catch (error) {
    console.error("初始化失败：", error);
    alert("加载数据失败，请检查控制台日志。");
  } finally {
    isLoading.value = false;
  }
}

await init();

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

function openDatabase(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function exportToJson(db: IDBDatabase): Promise<any> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(db.objectStoreNames, 'readonly');
    const exportData: any = {};
    let count = db.objectStoreNames.length;

    for (const storeName of db.objectStoreNames) {
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        exportData[storeName] = request.result;
        if (--count === 0) resolve(exportData);
      };
      request.onerror = () => reject(request.error);
    }
  });
}

async function calculateDatabaseSize(db: IDBDatabase): Promise<number> {
  let totalSize = 0;

  for (const storeName of db.objectStoreNames) {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const data = request.result;
        totalSize += JSON.stringify(data).length / 1024 / 1024; // 转换为 MB
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  return totalSize;
}
</script>

<style>
/* 加载动画样式 */
.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>