<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 font-bold">缓存分析</h1>
    </Teleport>
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
      >
        导出所有数据库
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

async function init() {
  const storageUsage = await navigator.storage.estimate();
  const usedSize = (storageUsage.usage! / 1024 / 1024).toFixed(2);
  const totalSize = (storageUsage.quota! / 1024 / 1024).toFixed(2);
  const remainingSize = (storageUsage.quota! - storageUsage.usage!) / 1024 / 1024;

  usage.value = usedSize + ' MB';
  quota.value = totalSize + ' MB';
  remaining.value = remainingSize.toFixed(2) + ' MB';

  const dbs = await indexedDB.databases();
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
}

await init();

async function exportSingleDatabase(dbInfo: { name: string; version: number }) {
  const db = await openDatabase(dbInfo.name, dbInfo.version);
  const exportData = await exportToJson(db);
  const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${dbInfo.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportAllDatabases() {
  for (const db of databases.value) {
    await exportSingleDatabase(db);
  }
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
  const transaction = db.transaction(db.objectStoreNames, 'readonly');
  let totalSize = 0;

  for (const storeName of db.objectStoreNames) {
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    await new Promise<void>((resolve) => {
      request.onsuccess = () => {
        const data = request.result;
        totalSize += JSON.stringify(data).length / 1024 / 1024; // 转换为 MB
        resolve();
      };
    });
  }

  return totalSize;
}
</script>