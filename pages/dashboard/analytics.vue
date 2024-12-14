<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 font-bold">缓存分析</h1>
    </Teleport>
    <div class="flex flex-1 p-6 overflow-scroll">
      <p>本地数据库占用约为 <span class="text-rose-500">{{usage}}</span></p>
      <button @click="exportDatabase" class="mt-4 p-2 bg-blue-500 text-white rounded">导出数据库</button>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '缓存分析 | 微信公众号文章导出'
});

const usage = ref('')

async function init() {
  const storageUsage = await navigator.storage.estimate()
  const indexedSize = (storageUsage.usage! / 1024 / 1024).toFixed(2)
  usage.value = indexedSize + 'M'
}

await init()

async function exportDatabase() {
  const dbs = await indexedDB.databases();
  for (const dbInfo of dbs) {
    const db = await openDatabase(dbInfo.name!, dbInfo.version!);
    const exportData = await exportToJson(db);
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dbInfo.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
</script>