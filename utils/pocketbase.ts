const BASE_URL = localStorage.getItem('pbServer') || 'http://127.0.0.1:8090';
let authToken: string | null = null; // 用于存储登录后的身份验证令牌

// 登录功能
export async function login(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity: email, // 使用 "identity" 而不是 "email"
        password: password,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      authToken = data.token; // 保存 token
      console.log('登录成功！');
      return true;
    } else {
      const error = await response.text();
      console.error('登录失败：', error);
      return false;
    }
  } catch (error) {
    console.error('登录失败：', error);
    return false;
  }
}

// 获取记录列表
export async function getRecords(
  collectionName: string,
  page: number = 1,
  perPage: number = 30,
  queryParams: Record<string, any> = {} // 新增的查询参数
): Promise<any[]> {
  try {
    // 构建查询字符串
    const query = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      ...Object.fromEntries(
        Object.entries(queryParams).map(([key, value]) => {
          // 对 filter 参数进行特殊处理，确保其值被正确编码
          if (key === 'filter') {
            return [key, value]; // 不对 filter 的值进行 String 转换
          }
          return [key, String(value)];
        })
      ),
    }).toString();

    // 拼接完整的 URL
    const url = `${BASE_URL}/api/collections/${collectionName}/records?${query}`;

    // 调试输出 URL
    console.log(`请求 URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`获取记录成功！当前页: ${page}, 每页数量: ${perPage}`);
      return data.items || [];
    } else {
      const error = await response.text();
      console.error('获取记录失败：', error);
      return [];
    }
  } catch (error) {
    console.error('获取记录失败：', error);
    return [];
  }
}

// 创建新记录
export async function createRecord(collectionName: string, data: Record<string, any>): Promise<any | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/collections/${collectionName}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const record = await response.json();
      console.log('记录创建成功！');
      return record;
    } else {
      const error = await response.text();
      console.error('记录创建失败：', error);
      return null;
    }
  } catch (error) {
    console.error('记录创建失败：', error);
    return null;
  }
}

// 更新记录
export async function updateRecord(collectionName: string, recordId: string, data: Record<string, any>): Promise<any | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/collections/${collectionName}/records/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const updatedRecord = await response.json();
      console.log('记录更新成功！');
      return updatedRecord;
    } else {
      const error = await response.text();
      console.error('记录更新失败：', error);
      return null;
    }
  } catch (error) {
    console.error('记录更新失败：', error);
    return null;
  }
}

// 删除记录
export async function deleteRecord(collectionName: string, recordId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/collections/${collectionName}/records/${recordId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
    });

    if (response.ok) {
      console.log('记录删除成功！');
      return true;
    } else {
      const error = await response.text();
      console.error('记录删除失败：', error);
      return false;
    }
  } catch (error) {
    console.error('记录删除失败：', error);
    return false;
  }
}