// cloudfunctions/migrate-data/index.js
// 这是一个 ETL (Extract-Transform-Load) 脚本
// 作用：从 temp 临时表读取数据 -> 清洗 -> 写入标准业务表

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 批量写入工具函数
async function batchWrite(collectionName, items) {
  if (items.length === 0) return;
  const BATCH_SIZE = 50; 
  let count = 0;
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const tasks = batch.map(item => {
      const doc = { ...item };
      const id = doc._id;
      delete doc._id; // add操作不能自带_id，或者用 set 指定_id
      
      if (id) {
        // 如果有ID，尝试覆盖更新（保证幂等性）
        return db.collection(collectionName).doc(id).set({ data: doc });
      } else {
        return db.collection(collectionName).add({ data: doc });
      }
    });
    await Promise.all(tasks);
    count += batch.length;
    console.log(`[${collectionName}] 写入进度: ${count}/${items.length}`);
  }
}

exports.main = async (event, context) => {
  try {
    // 1. 读取临时表数据 (temp_funds)
    // 假设 CSV 已经导入到 temp_funds 集合
    const tempFundsRes = await db.collection('temp_funds').limit(1000).get();
    const rawFunds = tempFundsRes.data;
    
    // 同样读取交易记录 (temp_transactions)
    const tempTransRes = await db.collection('temp_transactions').limit(1000).get();
    const rawTrans = tempTransRes.data;

    console.log(`读取到 ${rawFunds.length} 条持仓记录，${rawTrans.length} 条交易记录`);

    // 2. 清洗数据：提取基金元数据 (fund_basic)
    const fundBasicMap = new Map();
    rawFunds.forEach(item => {
      // 这里的字段名要对应你 CSV 里的表头，比如 item.fund_code
      if (!fundBasicMap.has(item.fund_code)) {
        fundBasicMap.set(item.fund_code, {
          _id: String(item.fund_code), // 用代码做主键
          code: String(item.fund_code),
          name: item.fund_name || '未命名基金',
          type: item.fund_type || '混合型', 
          update_time: db.serverDate()
        });
      }
    });

    // 3. 清洗数据：提取用户持仓 (user_portfolio)
    const portfolios = rawFunds.map(item => {
      return {
        // 这里不指定 _id，系统自动生成
        fund_code: String(item.fund_code),
        total_shares: Number(item.shares),
        avg_cost: Number(item.cost),
        // 初始导入时，总成本 = 份额 * 成本
        total_cost: Number(item.shares) * Number(item.cost),
        update_time: db.serverDate()
      };
    });

    // 4. 清洗数据：提取交易流水 (fund_transactions)
    const transactions = rawTrans.map(item => {
      return {
        fund_code: String(item.fund_code),
        type: item.type === '买入' ? 'buy' : 'sell', // 根据实际CSV值调整
        date: item.date,
        shares: Number(item.shares),
        price: Number(item.price || 0),
        amount: Number(item.amount || 0),
        note: item.note,
        created_at: db.serverDate()
      };
    });

    // 5. 执行写入
    // 写入 fund_basic
    await batchWrite('fund_basic', Array.from(fundBasicMap.values()));
    // 写入 user_portfolio
    await batchWrite('user_portfolio', portfolios);
    // 写入 fund_transactions
    await batchWrite('fund_transactions', transactions);

    return {
      success: true,
      msg: '数据迁移完成',
      stats: {
        funds: fundBasicMap.size,
        portfolios: portfolios.length,
        transactions: transactions.length
      }
    };

  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};